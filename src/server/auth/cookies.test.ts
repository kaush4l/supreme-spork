import { describe, expect, test } from "bun:test";
import { cookieName, hardenCookie, SESSION_MAX_AGE_SECONDS } from "./cookies";

describe("session cookies", () => {
  test("are never readable by script, whatever the library asked for", () => {
    const asked = {
      httpOnly: false,
      secure: false,
      sameSite: "none" as const,
      path: "/x",
      domain: "example.com",
      maxAge: 60,
    };
    const set = hardenCookie(asked, true);
    expect(set.httpOnly).toBe(true);
    expect(set.secure).toBe(true);
    expect(set.sameSite).toBe("lax");
    expect(set.path).toBe("/");
    expect(set.domain).toBeUndefined();
    expect(set.maxAge).toBe(60);
  });

  test("none lives longer than 30 days, and a deletion stays a deletion", () => {
    const fourHundredDays = 400 * 24 * 60 * 60;
    expect(hardenCookie({ maxAge: fourHundredDays }, true).maxAge).toBe(
      SESSION_MAX_AGE_SECONDS,
    );
    expect(hardenCookie({}, true).maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(hardenCookie({ maxAge: 0 }, true).maxAge).toBe(0);
    expect(SESSION_MAX_AGE_SECONDS).toBe(2592000);
  });

  test("hardening applies to a missing options object too", () => {
    expect(hardenCookie(undefined, false)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  });

  test("production uses the __Host- prefix and development does not", () => {
    expect(cookieName(true)).toBe("__Host-minder-auth");
    expect(cookieName(false)).toBe("minder-auth");
  });
});
