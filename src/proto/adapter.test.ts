import { describe, expect, test } from "bun:test";
import {
  queryDockets,
  queryInbox,
  searchStaff,
  simulateMutation,
} from "./adapter";
import { allDockets } from "./fixtures/dockets";
import { initialInbox } from "./fixtures/inbox";
import { staff } from "./fixtures/staff";

const all = allDockets("v-harbour", 120);

describe("adapter", () => {
  test("D-0111 beyond page one for default sort, found by search", () => {
    const p1 = queryDockets(all, { limit: 25, offset: 0 });
    expect(p1.items.some((d) => d.id === "D-0111")).toBe(false);
    const hit = queryDockets(all, { q: "D-0111", limit: 25, offset: 0 });
    expect(hit.items.map((d) => d.id)).toEqual(["D-0111"]);
    expect(hit.total).toBe(1);
  });

  test("filter before paginate", () => {
    const expected = all.filter((d) => d.status === "approved").length;
    const p = queryDockets(all, { status: "approved", limit: 10, offset: 0 });
    expect(p.total).toBe(expected);
    expect(p.items.length).toBe(Math.min(10, expected));
    expect(p.items.every((d) => d.status === "approved")).toBe(true);
    const z = queryDockets(all, { q: "no-such-thing", limit: 10, offset: 0 });
    expect(z.total).toBe(0);
    expect(z.items).toEqual([]);
  });

  test("clamping", () => {
    const p = queryDockets(all, { limit: 25, offset: 9999 });
    expect(p.clamped).toBe(true);
    expect(p.offset).toBe(100);
    expect(p.items.length).toBe(20);
    const ok = queryDockets(all, { limit: 25, offset: 25 });
    expect(ok.clamped).toBeUndefined();
    const exact = queryDockets(allDockets("v-harbour", 25), {
      limit: 25,
      offset: 25,
    });
    expect(exact.offset).toBe(0);
    expect(queryDockets([], { limit: 25, offset: 50 }).offset).toBe(0);
  });

  test("stable sort with id tie-break and paging has no overlap", () => {
    const sorts = [
      "date_desc",
      "date_asc",
      "supplier_asc",
      "total_desc",
    ] as const;
    for (const sort of sorts) {
      const seen = new Set<string>();
      for (let off = 0; off < 120; off += 25) {
        for (const d of queryDockets([...all].reverse(), {
          sort,
          limit: 25,
          offset: off,
        }).items) {
          expect(seen.has(d.id)).toBe(false);
          seen.add(d.id);
        }
      }
      expect(seen.size).toBe(120);
      expect(
        queryDockets([...all].reverse(), { sort, limit: 25, offset: 0 }),
      ).toEqual(queryDockets(all, { sort, limit: 25, offset: 0 }));
    }
  });

  test("inbox query", () => {
    const items = initialInbox("u-staff", "v-harbour");
    const p = queryInbox(items, { tab: "action", limit: 20, offset: 0 });
    expect(p.items.every((i) => i.tab === "action")).toBe(true);
    expect(p.total).toBe(24);
    const u = queryInbox(items, {
      tab: "updates",
      unreadOnly: true,
      limit: 20,
      offset: 0,
    });
    expect(u.items.every((i) => !i.read)).toBe(true);
  });

  test("staff search over full set", () => {
    expect(searchStaff(staff, "", 20, 0).total).toBe(250);
    const r = searchStaff(staff, "Konstantinopoulos", 20, 0);
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(searchStaff(staff, "zzzzqq", 20, 0).items).toEqual([]);
  });

  test("simulateMutation", () => {
    const seen = new Set<string>();
    let n = 0;
    const fn = () => ++n;
    expect(
      simulateMutation(fn, { scenario: "default", key: "a", seen }),
    ).toEqual({ status: "success", value: 1 });
    expect(
      simulateMutation(fn, { scenario: "default", key: "a", seen }),
    ).toEqual({ status: "duplicate" });
    expect(n).toBe(1);
    expect(
      simulateMutation(fn, { scenario: "slow", key: "b", seen }).status,
    ).toBe("pending");
    expect(
      simulateMutation(fn, { scenario: "error", key: "c", seen }).status,
    ).toBe("failure");
    expect(n).toBe(1);
  });
});
