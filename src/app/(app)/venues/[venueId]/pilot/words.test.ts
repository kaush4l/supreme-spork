import { describe, expect, test } from "bun:test";
import type { PilotMeasure, PilotWeek } from "@/server/data/pilot";
import {
  figureWords,
  passMarkWords,
  statusWords,
  weekColumns,
  weekRows,
} from "./words";

const m = (over: Partial<PilotMeasure>): PilotMeasure => ({
  key: "k",
  label: "Label",
  value: null,
  numerator: null,
  denominator: null,
  pass_mark: null,
  status: "met",
  basis: "b",
  ...over,
});

describe("pilot scorecard words", () => {
  test("every status has plain words", () => {
    expect(statusWords("met").label).toBe("Met");
    expect(statusWords("not_met").label).toBe("Not met");
    expect(statusWords("not_enough_data").label).toBe("Not enough data yet");
    expect(statusWords("reported").label).toBe("For information");
    expect(statusWords("tracked_outside_app").label).toBe(
      "Tracked outside the app",
    );
  });
  test("the figure is the backend's value with its counts", () => {
    expect(figureWords(m({ value: 50, numerator: 1, denominator: 2 }))).toBe(
      "50% (1 of 2)",
    );
    expect(figureWords(m({ value: 0, numerator: 0, denominator: 22 }))).toBe(
      "0% (0 of 22)",
    );
    expect(figureWords(m({ value: null }))).toBeNull();
  });
  test("the pass mark", () => {
    expect(passMarkWords(m({ pass_mark: 80 }))).toBe("Pass mark 80%");
    expect(passMarkWords(m({ pass_mark: null }))).toBeNull();
  });
  test("weeks become n/d cells, and a measure with no weekly counts has no column", () => {
    const measures = [
      m({ key: "a", label: "A" }),
      m({ key: "bug", label: "B" }),
    ];
    const weeks: PilotWeek[] = [
      {
        week_start: "2026-11-09",
        counts: { a: { numerator: 1, denominator: 3 } },
      },
      {
        week_start: "2026-11-16",
        counts: { a: { numerator: 0, denominator: 0 } },
      },
    ];
    expect(weekColumns(measures, weeks)).toEqual([{ key: "a", header: "A" }]);
    expect(weekRows(measures, weeks)).toEqual([
      { id: "2026-11-09", week: "2026-11-09", a: "1/3" },
      { id: "2026-11-16", week: "2026-11-16", a: "0/0" },
    ]);
  });
});
