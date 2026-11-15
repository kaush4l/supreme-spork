import { describe, expect, test } from "bun:test";
import { authBaseUrl, parseEnv } from "./env-schema";

const good = {
  BACKEND_URL: "http://backend:8000",
  AUTH_URL: "http://auth:9999/auth/v1",
  AUTH_ANON_KEY: "a".repeat(40),
  SITE_URL: "https://app.example.com",
};

describe("parseEnv", () => {
  test("accepts a complete environment", () => {
    expect(parseEnv(good).BACKEND_URL).toBe("http://backend:8000");
  });

  test("names every missing or invalid variable and never shows a value", () => {
    const bad = { ...good, BACKEND_URL: "not a url", AUTH_ANON_KEY: "short" };
    let message = "";
    try {
      parseEnv(bad);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("BACKEND_URL");
    expect(message).toContain("AUTH_ANON_KEY");
    expect(message).not.toContain("not a url");
    expect(message).not.toContain("short");
  });

  test("an empty environment fails", () => {
    expect(() => parseEnv({})).toThrow(/SITE_URL/);
  });

  test("production needs an https site address", () => {
    expect(() =>
      parseEnv({
        ...good,
        SITE_URL: "http://app.example.com",
        NODE_ENV: "production",
      }),
    ).toThrow(/https/);
    expect(parseEnv({ ...good, NODE_ENV: "production" }).SITE_URL).toBe(
      "https://app.example.com",
    );
    expect(
      parseEnv({
        ...good,
        SITE_URL: "http://localhost:3000",
        NODE_ENV: "development",
      }).SITE_URL,
    ).toBe("http://localhost:3000");
    // a production build run on this machine (the browser tests) may use http://localhost; no real site can
    expect(
      parseEnv({
        ...good,
        SITE_URL: "http://localhost:3111",
        NODE_ENV: "production",
      }).SITE_URL,
    ).toBe("http://localhost:3111");
    expect(() =>
      parseEnv({
        ...good,
        SITE_URL: "http://localhost.evil.example.com",
        NODE_ENV: "production",
      }),
    ).toThrow(/https/);
  });
});

describe("the login service address", () => {
  test("must end with /auth/v1 and the base is what the Supabase client wants", () => {
    expect(() => parseEnv({ ...good, AUTH_URL: "http://auth:9999" })).toThrow(
      /AUTH_URL/,
    );
    expect(authBaseUrl("http://localhost:54321/auth/v1")).toBe(
      "http://localhost:54321",
    );
    expect(authBaseUrl("https://id.example.com/auth/v1/")).toBe(
      "https://id.example.com",
    );
  });
});
