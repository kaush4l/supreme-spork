import { describe, expect, test } from "bun:test";
import { summaryRow } from "./rows";

const base = {
  staff_ref: "S03",
  name: "Priya Nair",
  hours: 10,
  rate_cents: 3100,
  cost_cents: 31000,
  incomplete_sessions: 0,
  cash_paid_cents: 15000,
  unconfirmed_cents: 15000,
  difference_cents: -16000,
};

describe("summaryRow", () => {
  test("formats what the API sent without changing it", () => {
    const r = summaryRow(base);
    expect(r.hours).toBe("10 h");
    expect(r.cost).toBe("$310.00");
    expect(r.cash).toBe("$150.00");
    expect(r.difference).toContain("160.00");
    expect(r.name).toBe("Priya Nair");
  });
  test("says when there is no rate and when clock-ins are unfinished", () => {
    const r = summaryRow({ ...base, rate_cents: null, incomplete_sessions: 2 });
    expect(r.rate).toBe("No rate");
    expect(r.name).toContain("2 unfinished clock-ins");
  });
});
