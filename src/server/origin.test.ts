import { describe, expect, test } from "bun:test";
import { isSameSiteWrite, isWrite } from "./origin";

const SITE = "https://app.example.com";
const req = (method: string, headers: Record<string, string> = {}) => ({
  method,
  headers: new Headers(headers),
});

describe("isSameSiteWrite", () => {
  test("reads always pass", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(
        isSameSiteWrite(
          req(method, { origin: "https://evil.example.com" }),
          SITE,
        ),
      ).toBe(true);
    }
  });

  test("a write from this site passes", () => {
    expect(isSameSiteWrite(req("POST", { origin: SITE }), SITE)).toBe(true);
    expect(
      isSameSiteWrite(
        req("POST", { origin: SITE, "sec-fetch-site": "same-origin" }),
        SITE,
      ),
    ).toBe(true);
    expect(
      isSameSiteWrite(req("DELETE", { "sec-fetch-site": "same-origin" }), SITE),
    ).toBe(true);
  });

  test("a write from another origin is refused", () => {
    expect(
      isSameSiteWrite(
        req("POST", { origin: "https://evil.example.com" }),
        SITE,
      ),
    ).toBe(false);
    expect(
      isSameSiteWrite(req("POST", { origin: "http://app.example.com" }), SITE),
    ).toBe(false);
    expect(
      isSameSiteWrite(
        req("POST", { origin: "https://app.example.com:8443" }),
        SITE,
      ),
    ).toBe(false);
    expect(
      isSameSiteWrite(
        req("POST", { origin: "https://app.example.com.evil.com" }),
        SITE,
      ),
    ).toBe(false);
    expect(isSameSiteWrite(req("POST", { origin: "null" }), SITE)).toBe(false);
  });

  test("a write the browser marks cross-site or same-site is refused even with a matching Origin", () => {
    expect(
      isSameSiteWrite(
        req("POST", { origin: SITE, "sec-fetch-site": "cross-site" }),
        SITE,
      ),
    ).toBe(false);
    expect(
      isSameSiteWrite(
        req("POST", { origin: SITE, "sec-fetch-site": "same-site" }),
        SITE,
      ),
    ).toBe(false);
  });

  test("a write with no Origin and no browser proof is refused", () => {
    expect(isSameSiteWrite(req("POST"), SITE)).toBe(false);
    expect(
      isSameSiteWrite(req("PUT", { "sec-fetch-site": "none" }), SITE),
    ).toBe(false);
  });

  test("which methods are writes", () => {
    expect(["POST", "put", "Patch", "DELETE"].every(isWrite)).toBe(true);
    expect(["GET", "HEAD", "OPTIONS"].some(isWrite)).toBe(false);
  });
});
