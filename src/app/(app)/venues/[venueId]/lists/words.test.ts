import { describe, expect, test } from "bun:test";
import {
  groupMyLists,
  lateWords,
  overdueFirst,
  progressWords,
  rangeWords,
} from "./words";

const p = {
  items: 5,
  answered: 3,
  required: 0,
  required_answered: 0,
  not_applicable: 0,
  out_of_range: 0,
};

describe("list words", () => {
  test("progress shows only what applies", () => {
    expect(progressWords(p)).toBe("3 of 5 done");
    expect(
      progressWords({
        ...p,
        required: 2,
        required_answered: 1,
        not_applicable: 1,
        out_of_range: 2,
      }),
    ).toBe(
      "3 of 5 done, 1 of 2 required, 1 not applicable, 2 readings outside range",
    );
    expect(progressWords({ ...p, out_of_range: 1 })).toContain(
      "1 reading outside range",
    );
  });
  test("range words", () => {
    expect(rangeWords(2, 8)).toBe("2 to 8");
    expect(rangeWords(2, null)).toBe("at least 2");
    expect(rangeWords(null, 8)).toBe("at most 8");
    expect(rangeWords(null, null)).toBeNull();
    expect(rangeWords(0, 0)).toBe("0 to 0");
  });
  test("late words", () => {
    expect(lateWords(5)).toBe("5 min late");
    expect(lateWords(65)).toBe("1 h 5 min late");
    expect(lateWords(120)).toBe("2 h late");
    expect(lateWords(-3)).toBe("0 min late");
  });
  test("overdue first keeps the backend order otherwise", () => {
    const rows = [
      { id: 1, status: "done" },
      { id: 2, status: "open" },
      { id: 3, status: "overdue" },
      { id: 4, status: "open" },
    ];
    expect(overdueFirst(rows).map((r) => r.id)).toEqual([3, 2, 4, 1]);
  });
  test("my lists group open first, then not done, then done", () => {
    const groups = groupMyLists([
      { status: "done" },
      { status: "open" },
      { status: "overdue" },
    ]);
    expect(groups.map((g) => g.title)).toEqual(["To do", "Done"]);
    expect(groups[0]?.lists.map((l) => l.status)).toEqual(["overdue", "open"]);
  });
});
