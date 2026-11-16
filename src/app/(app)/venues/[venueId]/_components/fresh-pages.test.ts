import { describe, expect, test } from "bun:test";
import { staysFresh } from "./fresh-pages";

const base = "/venues/abc";

describe("staysFresh", () => {
  test("pages where state changes under a person's hands refresh", () => {
    for (const p of [
      "/attention",
      "/notices",
      "/approvals",
      "/roster/offers",
      "/roster/drafts/123",
      "/shifts/drafts",
      "/shifts/offers/123",
      "/actions/9",
    ]) {
      expect(staysFresh(`${base}${p}`, base)).toBe(true);
    }
  });
  test("other pages are read once", () => {
    for (const p of [
      "/pnl",
      "/suppliers",
      "/team",
      "/settings",
      "/roster",
      "",
    ]) {
      expect(staysFresh(`${base}${p}`, base)).toBe(false);
    }
  });
  test("another venue's path never matches", () => {
    expect(staysFresh("/venues/zzz/notices", base)).toBe(false);
  });
});
