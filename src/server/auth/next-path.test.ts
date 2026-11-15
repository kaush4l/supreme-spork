import { describe, expect, test } from "bun:test";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  test("follows a plain path on this site, with its query", () => {
    expect(safeNextPath("/venues/abc")).toBe("/venues/abc");
    expect(safeNextPath("/venues/abc?tab=staff")).toBe("/venues/abc?tab=staff");
    expect(safeNextPath("/")).toBe("/");
  });

  test("never follows another site, however it is written", () => {
    for (const hostile of [
      "https://evil.example.com",
      "//evil.example.com",
      "/\\evil.example.com",
      "\\\\evil.example.com",
      "javascript:alert(1)",
      "evil.example.com",
      "/%2F%2Fevil.example.com/..",
      "/\t/evil.example.com",
      "/\n/evil.example.com",
      "http:evil.example.com",
    ]) {
      expect(safeNextPath(hostile)).toBe("/");
    }
  });

  test("falls back when there is nothing usable", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/");
    expect(safeNextPath("nope", "/home")).toBe("/home");
  });

  test("does not send a person back into the sign-in or callback routes", () => {
    expect(safeNextPath("/sign-in")).toBe("/");
    expect(safeNextPath("/auth/callback?code=1")).toBe("/");
  });
});
