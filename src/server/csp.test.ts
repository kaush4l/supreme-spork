import { describe, expect, test } from "bun:test";
import { buildCsp, newNonce } from "./csp";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("buildCsp", () => {
  const csp = buildCsp("abc123", { dev: false });

  test("scripts run only with this request's nonce", () => {
    expect(directive(csp, "script-src")).toBe(
      "'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(csp).not.toContain("unsafe-eval");
    expect(directive(csp, "script-src")).not.toContain("unsafe-inline");
  });

  test("style elements are nonce-only and only attributes are open", () => {
    expect(directive(csp, "style-src")).toBe(
      "'self' 'nonce-abc123' 'sha256-/i2+VVt2qoVh0Ag9OWwyc9593DCZeYGAv6SliqVbheY=' 'sha256-Z5XTK23DFuEMs0PwnyZDO9SWxemQ5HxcpVaBNuUJyWY='",
    );
    expect(directive(csp, "style-src-attr")).toBe("'unsafe-inline'");
  });

  test("the page cannot be framed, loads no plugins and posts forms only to itself", () => {
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "form-action")).toBe("'self'");
    expect(directive(csp, "base-uri")).toBe("'self'");
    expect(directive(csp, "default-src")).toBe("'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  test("development adds only what the dev server needs", () => {
    const dev = buildCsp("abc123", { dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  test("no frame is allowed unless a frame source is configured", () => {
    expect(directive(csp, "frame-src")).toBe("'none'");
    const withCaptcha = buildCsp("n", {
      dev: false,
      frameSources: ["https://challenges.cloudflare.com"],
    });
    expect(directive(withCaptcha, "frame-src")).toBe(
      "https://challenges.cloudflare.com",
    );
  });

  test("photo sources are added to img-src and nothing else", () => {
    const withStorage = buildCsp("n", {
      dev: false,
      imgSources: ["https://files.example.com"],
    });
    expect(directive(withStorage, "img-src")).toBe(
      "'self' blob: data: https://files.example.com",
    );
    expect(directive(withStorage, "connect-src")).toBe("'self'");
  });
});

describe("newNonce", () => {
  test("is different every time and safe inside a header", () => {
    const seen = new Set(Array.from({ length: 50 }, newNonce));
    expect(seen.size).toBe(50);
    for (const nonce of seen) expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
