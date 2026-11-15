import { describe, expect, test } from "bun:test";
import { contextWordProblem, fitsHashLimit, normalise } from "./password-words";

describe("passwords built from the product's words", () => {
  test("a password with a product word is refused, whatever the case or swaps", () => {
    for (const bad of [
      "Minder-Horse-Battery-92",
      "my-M1nd3r-p@ss-2026",
      "correct horse RESTAURANT staple",
      "ThePass 2026 2026 2026",
    ])
      expect(contextWordProblem(bad)).not.toBeNull();
  });
  test("a password with the person's own email name is refused", () => {
    expect(
      contextWordProblem("jordanlee-Horse-staple-91", "jordanlee@example.com"),
    ).not.toBeNull();
    expect(
      contextWordProblem("gmailish-staple-91-horse", "x@gmailish.com"),
    ).not.toBeNull();
  });
  test("short email parts are ignored and an unrelated password passes", () => {
    expect(contextWordProblem("tr1cky-spike-horse-91x", "ab@x.io")).toBeNull();
    expect(contextWordProblem("Tr1cky-Spike-Horse-91x")).toBeNull();
  });
  test("normalise drops punctuation and undoes digit swaps", () => {
    expect(normalise("M1nd3r_P@ss!")).toBe("minderpassi");
  });
});

describe("the 72 byte limit of the password hash", () => {
  test("72 bytes fit, 73 do not, and multi-byte letters count as bytes", () => {
    expect(fitsHashLimit("a".repeat(72))).toBe(true);
    expect(fitsHashLimit("a".repeat(73))).toBe(false);
    expect(fitsHashLimit("é".repeat(36))).toBe(true);
    expect(fitsHashLimit("é".repeat(37))).toBe(false);
  });
});
