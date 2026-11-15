import { describe, expect, test } from "bun:test";
import { DATASETS, isDataset } from "./datasets";

describe("download datasets", () => {
  test("only the backend's datasets are known", () => {
    expect(DATASETS.map((d) => d.key)).toEqual([
      "sales",
      "purchases",
      "bank",
      "labour",
    ]);
    expect(isDataset("bank")).toBe(true);
    expect(isDataset("pnl")).toBe(false);
    expect(isDataset("../x")).toBe(false);
  });
});
