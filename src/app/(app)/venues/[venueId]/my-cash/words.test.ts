import { describe, expect, test } from "bun:test";
import { paymentFor, statusFor } from "./words";

describe("my cash words", () => {
  test("what it was for", () => {
    expect(paymentFor({ kind: "wages" })).toBe("Wages");
    expect(paymentFor({ kind: "wages", note: "  Saturday  " })).toBe(
      "Wages: Saturday",
    );
    expect(paymentFor({ kind: "petty", note: "" })).toBe("Cash payment");
  });
  test("status words are addressed to the person paid", () => {
    expect(statusFor("unconfirmed", "Waiting for the person to confirm")).toBe(
      "Waiting for you to confirm",
    );
    expect(statusFor("cancelled", "Cancelled")).toBe("Cancelled");
    expect(statusFor("zzz", "From the backend")).toBe("From the backend");
  });
});
