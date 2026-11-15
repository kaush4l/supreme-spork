import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { ApiFailure } from "./api/errors";
import { createPublicAction } from "./public-action-core";

const logged: unknown[] = [];
const make = (sameSite = true) =>
  createPublicAction({
    sameSite: async () => sameSite,
    log: (_m, e) => logged.push(e),
  });
const schema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("publicAction", () => {
  test("a cross-site request is refused before anything is read", async () => {
    let ran = false;
    const act = make(false)(schema, async () => {
      ran = true;
      return null;
    });
    const state = await act(null, form({ email: "a@b.co", password: "x" }));
    expect(ran).toBe(false);
    expect(state?.message).toContain("did not come from this site");
  });

  test("only the schema's fields are read; the framework's hidden fields are ignored", async () => {
    let seen: unknown;
    const act = make()(schema, async (input) => {
      seen = input;
      return { ok: true };
    });
    await act(
      null,
      form({
        email: "a@b.co",
        password: "pw",
        $ACTION_ID_abc: "1",
        $ACTION_REF_1: "x",
        extra: "y",
      }),
    );
    expect(seen).toEqual({ email: "a@b.co", password: "pw" });
  });

  test("a bad value names the field and never echoes what was typed", async () => {
    const act = make()(schema, async () => ({ ok: true }));
    const state = await act(
      null,
      form({ email: "not-an-email", password: "hunter2" }),
    );
    expect(state?.fields).toEqual({ email: "Check this field." });
    expect(JSON.stringify(state)).not.toContain("not-an-email");
    const missing = await act(null, form({ email: "a@b.co" }));
    expect(missing?.fields).toEqual({ password: "Check this field." });
  });

  test("a failure from the backend shows its own words; anything else is logged and generic", async () => {
    logged.length = 0;
    const refused = make()(schema, async () => {
      throw new ApiFailure(403, "x", "You do not have access to that.");
    });
    expect(
      (await refused(null, form({ email: "a@b.co", password: "x" })))?.message,
    ).toBe("You do not have access to that.");
    const broken = make()(schema, async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");
    });
    const state = await broken(null, form({ email: "a@b.co", password: "x" }));
    expect(JSON.stringify(state)).not.toContain("hunter2");
    expect(state?.message).toBe(
      "Something went wrong on our side. Please try again.",
    );
    expect(logged.length).toBe(1);
  });

  test("a redirect from the action reaches the framework", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/home;307;",
    });
    const act = make()(schema, async () => {
      throw redirect;
    });
    await expect(
      act(null, form({ email: "a@b.co", password: "x" })),
    ).rejects.toBe(redirect);
  });
});
