import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createAction, strictInput } from "./action-core";
import { ApiFailure } from "./api/errors";

const principal = { userId: "u1" };
const logged: unknown[] = [];

function makeAction(signedIn = true) {
  return createAction({
    requirePrincipal: async () => {
      if (!signedIn) throw new Error("REDIRECT:/sign-in");
      return principal;
    },
    signInRequired: () => {
      throw new Error("REDIRECT:/sign-in");
    },
    log: (_message, error) => logged.push(error),
  });
}

const schema = strictInput({
  name: z.string().min(1).max(40),
  qty: z.number().int().min(0),
});

describe("action", () => {
  test("a person who is not signed in never reaches the input or the backend", async () => {
    let ran = false;
    const act = makeAction(false)(schema, async () => {
      ran = true;
    });
    await expect(act({ name: "x", qty: 1 })).rejects.toThrow(
      "REDIRECT:/sign-in",
    );
    expect(ran).toBe(false);
  });

  test("valid input reaches the handler with the principal", async () => {
    const act = makeAction()(schema, async (input, who) => ({
      got: input.name,
      by: who.userId,
    }));
    expect(await act({ name: "Dish", qty: 2 })).toEqual({
      ok: true,
      data: { got: "Dish", by: "u1" },
    });
  });

  test("an unknown field is refused, never ignored", async () => {
    let ran = false;
    const act = makeAction()(schema, async () => {
      ran = true;
    });
    const result = await act({ name: "x", qty: 1, role: "owner" });
    expect(ran).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_error");
      expect(result.error.fields?.role).toBe("Not accepted.");
    }
  });

  test("a bad value names the field and does not echo what was sent", async () => {
    const act = makeAction()(schema, async () => 1);
    const result = await act({ name: "", qty: -5 });
    expect(JSON.stringify(result)).not.toContain("-5");
    expect(
      result.ok === false && Object.keys(result.error.fields ?? {}).sort(),
    ).toEqual(["name", "qty"]);
  });

  test("a backend refusal comes back as a result with the backend's own words", async () => {
    const act = makeAction()(schema, async () => {
      throw new ApiFailure(403, "forbidden", "You do not have access to that.");
    });
    expect(await act({ name: "x", qty: 1 })).toEqual({
      ok: false,
      error: { code: "forbidden", message: "You do not have access to that." },
    });
  });

  test("a backend field error is attached to its field", async () => {
    const act = makeAction()(schema, async () => {
      throw new ApiFailure(
        422,
        "bad_week",
        "Give the week as a Monday.",
        "week",
      );
    });
    const result = await act({ name: "x", qty: 1 });
    expect(result.ok === false && result.error.fields).toEqual({
      week: "Give the week as a Monday.",
    });
  });

  test("a 401 from the backend sends the person to sign in", async () => {
    const act = makeAction()(schema, async () => {
      throw new ApiFailure(401, "error", "Please sign in again.");
    });
    await expect(act({ name: "x", qty: 1 })).rejects.toThrow(
      "REDIRECT:/sign-in",
    );
  });

  test("an unexpected error is logged and answered with nothing from inside", async () => {
    logged.length = 0;
    const act = makeAction()(schema, async () => {
      throw new Error("select * from users where password = 'hunter2'");
    });
    const result = await act({ name: "x", qty: 1 });
    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(result).toEqual({
      ok: false,
      error: {
        code: "server_error",
        message: "Something went wrong on our side. Please try again.",
      },
    });
    expect(logged.length).toBe(1);
  });

  test("redirects thrown by the framework pass through", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/done;307;",
    });
    const act = makeAction()(schema, async () => {
      throw redirect;
    });
    await expect(act({ name: "x", qty: 1 })).rejects.toBe(redirect);
  });
});
