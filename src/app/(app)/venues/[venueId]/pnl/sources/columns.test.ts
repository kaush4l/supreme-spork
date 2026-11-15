import { describe, expect, test } from "bun:test";
import { cellText, rowCells } from "./columns";

describe("source columns", () => {
  test("values follow their kind", () => {
    expect(cellText("money_cents", -400000, "Australia/Sydney")).toBe(
      "-$4,000.00",
    );
    expect(cellText("percent", "75.0", "UTC")).toBe("75.0%");
    expect(cellText("date", "2026-11-06", "UTC")).toBe("2026-11-06");
    expect(cellText("number", 3, "UTC")).toBe("3");
    expect(cellText("text", null, "UTC")).toBeNull();
    expect(cellText("datetime", "2026-11-06T09:00:00Z", "UTC")).toContain(
      "9:00",
    );
  });
  test("cells keep the API's order and drop empty values and unlisted fields", () => {
    const cells = rowCells(
      [
        { key: "posted_on", label: "Date", kind: "date" },
        { key: "description", label: "Description", kind: "text" },
        { key: "amount_cents", label: "Amount", kind: "money_cents" },
      ],
      { amount_cents: 500, posted_on: "2026-11-06", description: "", id: "x" },
      "UTC",
    );
    expect(cells).toEqual([
      { label: "Date", text: "2026-11-06" },
      { label: "Amount", text: "$5.00" },
    ]);
  });
});
