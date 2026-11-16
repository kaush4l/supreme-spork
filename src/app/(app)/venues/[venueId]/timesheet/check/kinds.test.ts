import { describe, expect, test } from "bun:test";
import { groupByKind, kindWords, minutesWords } from "./kinds";

describe("kinds", () => {
  test("plain headings, unknown kinds get a readable fallback", () => {
    expect(kindWords("missing_out")).toBe("Still clocked in");
    expect(kindWords("no_rate")).toBe("No pay rate");
    expect(kindWords("odd_new_kind")).toBe("odd new kind");
  });
  test("groups follow the working order, empty groups are left out, unknown kinds last", () => {
    const rows = [
      { kind: "no_rate", n: 1 },
      { kind: "weird", n: 2 },
      { kind: "no_show", n: 3 },
      { kind: "no_show", n: 4 },
    ];
    const g = groupByKind(rows);
    expect(g.map((x) => x.kind)).toEqual(["no_show", "no_rate", "weird"]);
    expect(g[0].rows.map((r) => r.n)).toEqual([3, 4]);
    expect(groupByKind([])).toEqual([]);
  });
  test("minutes words", () => {
    expect(minutesWords(-240)).toBe("-240 min");
    expect(minutesWords(15)).toBe("+15 min");
    expect(minutesWords(0)).toBe("0 min");
  });
});
