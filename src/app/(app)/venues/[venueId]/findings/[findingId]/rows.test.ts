import { describe, expect, test } from "bun:test";
import { factLines, groupWords, humanLabel, showValue, whyLines } from "./rows";

describe("rows", () => {
  test("labels", () => {
    expect(humanLabel("unit_price_cents")).toBe("Unit price");
    expect(humanLabel("recipe_coverage_pct")).toBe("Recipe coverage percent");
  });
  test("values", () => {
    expect(showValue("total_cents", 11530)).toBe("$115.30");
    expect(showValue("x_pct", "75.0")).toBe("75.0%");
    expect(showValue("void_flag", false)).toBe("No");
    expect(showValue("note", null)).toBeNull();
  });
  test("facts walk nested lists", () => {
    const lines = factLines({
      item: "Chicken",
      weeks: [{ balance_cents: 100 }, { balance_cents: 200, bills: ["ATO"] }],
    });
    expect(lines).toContainEqual({ label: "Item", value: "Chicken" });
    expect(lines).toContainEqual({
      label: "Weeks 1 / Balance",
      value: "$1.00",
    });
    expect(lines).toContainEqual({ label: "Weeks 2 / Bills", value: "ATO" });
  });
  test("group words", () => {
    expect(groupWords("transactions")).toBe("Bank rows");
    expect(groupWords("odd_group")).toBe("Odd group");
  });
  test("why list only for labour findings", () => {
    const c = [{ kind: "low_sales", cents: 5000, text: "Sales were low." }];
    expect(whyLines("waste", c, { over_target_cents: 9 })).toBeNull();
    expect(whyLines("labour_pct", c, { over_target_cents: 9000 })).toEqual({
      causes: c,
      overTarget: true,
    });
    expect(
      whyLines("labour_pct", [], { over_target_cents: 0 })?.overTarget,
    ).toBe(false);
    expect(whyLines("labour_pct", [], null)?.overTarget).toBe(false);
  });
});
