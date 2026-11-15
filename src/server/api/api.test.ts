import { describe, expect, test } from "bun:test";
import { assertSameOrigin, createBackendClient } from "./create-client";
import { ApiFailure, toApiFailure } from "./errors";
import { idempotencyHeader, newIdempotencyKey } from "./idempotency";

describe("toApiFailure", () => {
  test("reads the backend's own error shape", () => {
    const failure = toApiFailure(422, {
      error: {
        code: "bad_week",
        message: "Give the week as a Monday.",
        field: "week",
      },
    });
    expect(failure).toBeInstanceOf(ApiFailure);
    expect([
      failure.status,
      failure.code,
      failure.message,
      failure.field,
    ]).toEqual([422, "bad_week", "Give the week as a Monday.", "week"]);
  });

  test("reads the older detail shape", () => {
    const failure = toApiFailure(403, {
      detail: "You do not have access to this venue.",
    });
    expect(failure.message).toBe("You do not have access to this venue.");
    expect(failure.code).toBe("error");
  });

  test("a validation list names the field and never echoes the submitted value", () => {
    const failure = toApiFailure(422, {
      detail: [
        { loc: ["body", "email"], msg: "bad", input: "secret@example.com" },
      ],
    });
    expect(failure.field).toBe("email");
    expect(failure.message).not.toContain("secret@example.com");
    expect(failure.code).toBe("validation_error");
  });

  test("anything else becomes a generic sentence for the status", () => {
    expect(
      toApiFailure(500, "Traceback (most recent call last): ...").message,
    ).toBe("Something went wrong on our side. Please try again.");
    expect(toApiFailure(413, "Content Too Large").message).toBe(
      "That file is too large.",
    );
    expect(toApiFailure(404, null).message).toBe("We cannot find that.");
    expect(toApiFailure(418, undefined).message).toBe("That did not work.");
  });

  test("a 401 means sign in again", () => {
    expect(
      toApiFailure(401, { detail: "Please sign in again." }).needsSignIn,
    ).toBe(true);
    expect(toApiFailure(403, {}).needsSignIn).toBe(false);
  });
});

describe("idempotency keys", () => {
  test("are new each time and accepted as a header", () => {
    const keys = new Set(Array.from({ length: 20 }, newIdempotencyKey));
    expect(keys.size).toBe(20);
    const [key] = [...keys];
    expect(idempotencyHeader(key as string)["Idempotency-Key"]).toBe(
      key as string,
    );
  });

  test("a malformed key is refused", () => {
    for (const bad of [
      "",
      "short",
      "has space in it 123",
      "x".repeat(200),
      "line\nbreak12345",
    ]) {
      expect(() => idempotencyHeader(bad)).toThrow();
    }
  });
});

describe("the backend client", () => {
  test("refuses any host other than the backend", () => {
    expect(() =>
      assertSameOrigin("http://backend:8000", "http://backend:8000/v1/me"),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin("http://backend:8000", "http://evil.example.com/v1/me"),
    ).toThrow();
    expect(() =>
      assertSameOrigin("http://backend:8000", "http://backend:8001/v1/me"),
    ).toThrow();
    expect(() =>
      assertSameOrigin("https://backend:8000", "http://backend:8000/v1/me"),
    ).toThrow();
  });

  test("sends the access token, follows no redirect, and adds no cookie", async () => {
    let seen: Request | undefined;
    const client = createBackendClient({
      baseUrl: "http://backend:8000",
      accessToken: "token-123",
      fetch: (async (request: Request) => {
        seen = request;
        return new Response(
          JSON.stringify({
            user: null,
            memberships: [],
            venues: [],
            pending_invites: [],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }) as unknown as typeof fetch,
    });
    const { data, error } = await client.GET("/v1/me");
    expect(error).toBeUndefined();
    expect(data).toBeDefined();
    expect(seen?.url).toBe("http://backend:8000/v1/me");
    expect(seen?.headers.get("authorization")).toBe("Bearer token-123");
    expect(seen?.redirect).toBe("error");
    // Server-side fetch has no cookie jar; the one credential sent is the token, and no cookie header is added.
    expect(seen?.headers.has("cookie")).toBe(false);
  });

  test("sends no Authorization header without a token", async () => {
    let seen: Request | undefined;
    const client = createBackendClient({
      baseUrl: "http://backend:8000",
      fetch: (async (request: Request) => {
        seen = request;
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    await client.GET("/health" as never);
    expect(seen?.headers.has("authorization")).toBe(false);
  });
});
