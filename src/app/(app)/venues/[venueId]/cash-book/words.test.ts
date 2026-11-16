import { describe, expect, test } from "bun:test";
import { listHref, parseFilters, paymentTitle, periodText } from "./words";

describe("cash book words", () => {
  test("parseFilters keeps only valid values", () => {
    expect(
      parseFilters({
        kind: "wages",
        unconfirmed: "true",
        from: "2026-11-02",
        to: "nope",
        person: " S03 ",
      }),
    ).toEqual({
      kind: "wages",
      unconfirmed: true,
      from: "2026-11-02",
      person: "S03",
    });
    expect(parseFilters({ kind: "zzz", unconfirmed: "false" })).toEqual({});
  });
  test("listHref builds the address", () => {
    expect(listHref("v1", {})).toBe("/venues/v1/cash-book");
    expect(listHref("v1", { unconfirmed: true }, 50)).toBe(
      "/venues/v1/cash-book?unconfirmed=true&offset=50",
    );
  });
  test("paymentTitle says what was paid", () => {
    expect(paymentTitle({ kind: "wages", payee: { name: "Priya" } })).toBe(
      "Wages to Priya",
    );
    expect(
      paymentTitle({ kind: "supplier", supplier: { name: "Fish Co" } }),
    ).toBe("Paid Fish Co");
    expect(paymentTitle({ kind: "petty", note: "ice" })).toBe(
      "Petty cash: ice",
    );
  });
  test("periodText needs both ends", () => {
    expect(
      periodText({ pay_period_from: "a", pay_period_to: null }),
    ).toBeNull();
    expect(periodText({ pay_period_from: "a", pay_period_to: "b" })).toBe(
      "Pay period a to b",
    );
  });
});
