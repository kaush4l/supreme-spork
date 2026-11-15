import { describe, expect, test } from "bun:test";
import {
  mfaMessage,
  resetMessage,
  signInMessage,
  signUpMessage,
} from "./messages";

describe("sign-in messages", () => {
  test("a wrong password and an unknown address read the same", () => {
    const wrong = signInMessage({
      code: "invalid_credentials",
      status: 400,
      message: "Invalid login credentials",
    });
    expect(wrong).toBe("That email and password do not match.");
    expect(
      signInMessage({
        code: "invalid_credentials",
        status: 400,
        message: "anything else",
      }),
    ).toBe(wrong);
  });

  test("the lockout and the rate limit say to wait, and nothing about the account", () => {
    const locked = signInMessage({
      code: "invalid_credentials",
      status: 400,
      message: "Too many failed attempts. Try again in a few minutes.",
    });
    const limited = signInMessage({
      code: "over_request_rate_limit",
      status: 429,
    });
    expect(locked).toBe(limited);
    expect(locked).not.toMatch(/locked|account|password/i);
  });

  test("an unconfirmed address is told to confirm", () => {
    expect(
      signInMessage({ code: "email_not_confirmed", status: 400 }),
    ).toContain("Confirm your email");
  });

  test("the service's own words never reach the person", () => {
    const secret = "relation users_pkey violated at 10.0.0.5";
    for (const fn of [signInMessage, signUpMessage, resetMessage, mfaMessage]) {
      expect(
        fn({ code: "unexpected_failure", status: 500, message: secret }),
      ).not.toContain("10.0.0.5");
      expect(
        fn({ code: "unexpected_failure", status: 500, message: secret }),
      ).not.toContain("users_pkey");
    }
  });
});

describe("other messages", () => {
  test("a weak password is told the rule, not the reason it was found weak", () => {
    expect(signUpMessage({ code: "weak_password", status: 422 })).toContain(
      "12 characters",
    );
    expect(resetMessage({ code: "weak_password", status: 422 })).toContain(
      "12 characters",
    );
  });

  test("a wrong or expired authenticator code gets one sentence", () => {
    expect(
      mfaMessage({ code: "mfa_verification_failed", status: 422 }),
    ).toContain("not right");
    expect(
      mfaMessage({ code: "mfa_challenge_expired", status: 422 }),
    ).toContain("expired");
  });
});
