import { describe, expect, test } from "bun:test";
import { ApiFailure } from "./api/errors";
import { createHandler, MAX_BODY_BYTES } from "./handler-core";

const SITE = "https://app.example.com";

function make(signedIn = true) {
  const logged: unknown[] = [];
  const handler = createHandler({
    siteUrl: () => SITE,
    getPrincipal: async () => (signedIn ? { userId: "u1" } : null),
    log: (_message, error) => logged.push(error),
  });
  return { handler, logged };
}

const post = (headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/upload`, {
    method: "POST",
    headers: { origin: SITE, ...headers },
    body: "x",
  });

describe("route handler wrapper", () => {
  test("a signed-in, same-site write reaches the handler", async () => {
    const { handler } = make();
    const response = await handler(async (_request, who) =>
      Response.json({ by: who.userId }),
    )(post());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ by: "u1" });
  });

  test("a cross-site write is refused before anything else", async () => {
    const { handler } = make();
    let ran = false;
    const run = handler(async () => {
      ran = true;
      return new Response("ok");
    });
    const response = await run(post({ origin: "https://evil.example.com" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("cross_site_request");
    expect(ran).toBe(false);
  });

  test("nobody signed in gets a 401 in the backend's error shape", async () => {
    const { handler } = make(false);
    const response = await handler(async () => new Response("ok"))(post());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "sign_in_required",
        message: "Please sign in again.",
        field: null,
      },
    });
  });

  test("a body declared over the cap is refused unread", async () => {
    const { handler } = make();
    let ran = false;
    const run = handler(async () => {
      ran = true;
      return new Response("ok");
    });
    const response = await run(
      post({ "content-length": String(MAX_BODY_BYTES + 1) }),
    );
    expect(response.status).toBe(413);
    expect(ran).toBe(false);
    expect((await run(post({ "content-length": "abc" }))).status).toBe(413);
  });

  test("a backend refusal keeps its status, code and words", async () => {
    const { handler } = make();
    const run = handler(async () => {
      throw new ApiFailure(
        422,
        "unsupported_type",
        "Upload a photo or a PDF.",
        "file",
      );
    });
    const response = await run(post());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "unsupported_type",
        message: "Upload a photo or a PDF.",
        field: "file",
      },
    });
  });

  test("an unexpected error is logged and answered with nothing from inside", async () => {
    const { handler, logged } = make();
    const run = handler(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");
    });
    const response = await run(post());
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("10.0.0.5");
    expect(logged.length).toBe(1);
  });

  test("every answer is kept out of caches", async () => {
    const { handler } = make(false);
    const response = await handler(async () => new Response("ok"))(post());
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
