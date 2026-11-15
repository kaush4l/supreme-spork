import { describe, expect, test } from "bun:test";
import { callbackTarget } from "./callback-target";

describe("callbackTarget", () => {
  test("allows only the two places an email link leads to", () => {
    expect(callbackTarget("/sign-in?confirmed=1")).toBe("/sign-in?confirmed=1");
    expect(callbackTarget("/reset-password")).toBe("/reset-password");
  });

  test("everything else, however close, goes to the home page", () => {
    for (const other of [
      "/reset-password/",
      "//evil.example.com",
      "https://evil.example.com",
      "/sign-in",
      "/venues/x",
      "",
      null,
      undefined,
    ]) {
      expect(callbackTarget(other)).toBe("/");
    }
  });
});
