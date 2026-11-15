import { describe, expect, test } from "bun:test";
import { createBackendClient } from "./create-client";
import { ApiFailure } from "./errors";
import { fetchMe, meSchema } from "./me";

const body = {
  user: { id: "u1", email: "a@b.co", name: null },
  memberships: [
    { org_id: "o1", venue_id: "v1", role: "owner", approval_limit_cents: 0 },
  ],
  venues: [
    { id: "v1", org_id: "o1", name: "The Pass", timezone: "Australia/Sydney" },
  ],
  pending_invites: [
    { id: "i1", venue_id: "v2", venue_name: "Other", role: "staff" },
  ],
  mfa: { required: true, level: "aal1" },
};

const client = (response: () => Response) =>
  createBackendClient({
    baseUrl: "http://backend:8000",
    accessToken: "t",
    fetch: (async () => response()) as unknown as typeof fetch,
  });

describe("fetchMe", () => {
  test("returns the parsed answer", async () => {
    const me = await fetchMe(client(() => Response.json(body)));
    expect(me.venues[0]?.name).toBe("The Pass");
    expect(me.mfa).toEqual({ required: true, level: "aal1" });
  });

  test("a person with no row yet parses too", () => {
    const empty = {
      user: null,
      memberships: [],
      venues: [],
      pending_invites: [],
      mfa: { required: false, level: "aal1" },
    };
    expect(meSchema.safeParse(empty).success).toBe(true);
  });

  test("an answer of the wrong shape is a failure, not trusted data", async () => {
    await expect(
      fetchMe(client(() => Response.json({ user: 5 }))),
    ).rejects.toBeInstanceOf(ApiFailure);
  });

  test("a 401 from the backend becomes a sign-in-again failure", async () => {
    const failure = await fetchMe(
      client(() =>
        Response.json({ detail: "Please sign in again." }, { status: 401 }),
      ),
    ).catch((e) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).needsSignIn).toBe(true);
  });

  test("an unknown role is refused", () => {
    const bad = {
      ...body,
      memberships: [{ org_id: "o", venue_id: null, role: "root" }],
    };
    expect(meSchema.safeParse(bad).success).toBe(false);
  });
});
