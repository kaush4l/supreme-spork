import { describe, expect, test } from "bun:test";
import { queryDockets } from "../../adapter";
import { allDockets } from "../../fixtures/dockets";
import {
  applyChange,
  applyOverrides,
  DEFAULT_QUERY,
  formatCents,
  pageFromOffset,
  parseQueueParams,
  queueHref,
  rangeLabel,
  restorableContext,
  serializeQueueParams,
  toDocketQuery,
} from "./queue-state";

const parse = (s: string) => parseQueueParams(new URLSearchParams(s));

describe("query params", () => {
  test("round trips and omits defaults", () => {
    const q = {
      ...DEFAULT_QUERY,
      q: "Zephyr",
      status: "needs_review" as const,
      sort: "supplier_asc" as const,
      page: 3,
    };
    const s = serializeQueueParams(q);
    expect(s).toBe("q=Zephyr&status=needs_review&sort=supplier_asc&page=3");
    expect(parse(s)).toEqual(q);
    expect(serializeQueueParams(DEFAULT_QUERY)).toBe("");
  });
  test("invalid values fall back", () => {
    const q = parse("status=bogus&sort=x&page=-4&from=nope");
    expect(q).toEqual(DEFAULT_QUERY);
    expect(parse("page=abc").page).toBe(1);
  });
});

describe("applyChange", () => {
  test("filter, search and sort changes reset page", () => {
    const q = { ...DEFAULT_QUERY, page: 4 };
    expect(applyChange(q, { q: "x" }).page).toBe(1);
    expect(applyChange(q, { supplier: "A" }).page).toBe(1);
    expect(applyChange(q, { sort: "date_asc" }).page).toBe(1);
    expect(applyChange(q, { page: 2 }).page).toBe(2);
  });
});

describe("against the mock adapter", () => {
  const all = allDockets("v-harbour", 120);
  test("D-0111 is beyond page one and search finds it from the full set", () => {
    const first = queryDockets(all, toDocketQuery(DEFAULT_QUERY));
    expect(first.items.some((d) => d.id === "D-0111")).toBe(false);
    const hit = queryDockets(
      all,
      toDocketQuery({ ...DEFAULT_QUERY, q: "Zephyr" }),
    );
    expect(hit.total).toBe(1);
    expect(hit.items[0].id).toBe("D-0111");
    const byId = queryDockets(
      all,
      toDocketQuery({ ...DEFAULT_QUERY, q: "D-0111" }),
    );
    expect(byId.items[0].id).toBe("D-0111");
  });
  test("out of range page is clamped", () => {
    const r = queryDockets(all, toDocketQuery({ ...DEFAULT_QUERY, page: 99 }));
    expect(r.clamped).toBe(true);
    expect(pageFromOffset(r.offset)).toBe(5);
    expect(r.items.length).toBe(20);
  });
  test("range label", () => {
    expect(rangeLabel(25, 25, 120)).toBe("Showing 26–50 of 120");
    expect(rangeLabel(0, 0, 0)).toBe("Showing 0 of 0");
  });
});

describe("overrides and context", () => {
  test("status override leaves fixture untouched", () => {
    const all = allDockets("v-harbour", 3);
    const out = applyOverrides(all, { "v-harbour:D-0001": "approved" });
    expect(out[0].status).toBe("approved");
    expect(all[0].status).toBe(allDockets("v-harbour", 1)[0].status);
    expect(out[1]).toBe(all[1]);
  });
  test("context restores only for the same query", () => {
    const ctx = { qs: "page=3", scrollY: 420, selectedId: "D-0060" };
    expect(restorableContext(ctx, "page=3")).toEqual({
      scrollY: 420,
      selectedId: "D-0060",
    });
    expect(restorableContext(ctx, "page=2")).toBeNull();
  });
  test("href and money", () => {
    expect(queueHref("owner", "page=3")).toBe(
      "/proto/owner/money/dockets?page=3",
    );
    expect(queueHref("owner", "")).toBe("/proto/owner/money/dockets");
    expect(formatCents(null)).toBe("Missing");
    expect(formatCents(0)).toContain("0.00");
  });
});
