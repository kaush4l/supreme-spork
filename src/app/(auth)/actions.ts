"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ApiFailure } from "@/server/api/errors";
import { routeAfterSignIn, totpFactors } from "@/server/auth/flows";
import {
  mfaMessage,
  RESET_SENT,
  resetMessage,
  signInMessage,
  signUpMessage,
} from "@/server/auth/messages";
import { safeNextPath } from "@/server/auth/next-path";
import { requirePrincipal } from "@/server/auth/principal";
import { supabaseServer } from "@/server/auth/supabase";
import { env } from "@/server/env";
import { type FormState, publicAction } from "@/server/public-action";

const email = z.email().max(254);
const captcha = z.string().max(4096).optional();
const code = z.string().regex(/^\d{6}$/);
const next = z.string().max(512).optional();

/** The address a link in an email brings the person back to; the callback checks the code and follows `next`. */
const callback = (nextPath: string) =>
  `${env().SITE_URL}/auth/callback?next=${encodeURIComponent(nextPath)}`;

export const signIn = publicAction(
  z.strictObject({
    email,
    password: z.string().min(1).max(256),
    next,
    captchaToken: captcha,
  }),
  async (input) => {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
      options: input.captchaToken
        ? { captchaToken: input.captchaToken }
        : undefined,
    });
    if (error) return { message: signInMessage(error) };
    return redirect(await routeAfterSignIn(input.next));
  },
);

export const signUp = publicAction(
  z.strictObject({
    email,
    password: z.string().min(12).max(256),
    confirm: z.string().max(256),
    captchaToken: captcha,
  }),
  async (input) => {
    if (input.password !== input.confirm) {
      return {
        message: "The two passwords are not the same.",
        fields: { confirm: "Not the same." },
      };
    }
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: callback("/sign-in?confirmed=1"),
        captchaToken: input.captchaToken,
      },
    });
    // An address that already has an account looks exactly like a new one: both end at "check your email".
    if (error && error.code !== "user_already_exists")
      return { message: signUpMessage(error) };
    return redirect("/sign-up/check-email");
  },
);

export const forgotPassword = publicAction(
  z.strictObject({ email, captchaToken: captcha }),
  async (input) => {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: callback("/reset-password"),
      captchaToken: input.captchaToken,
    });
    if (error && (error.status === 429 || error.code === "captcha_failed"))
      return { message: resetMessage(error) };
    return { ok: true, message: RESET_SENT }; // the same answer for an address with an account and one without
  },
);

export const resetPassword = publicAction(
  z.strictObject({
    password: z.string().min(12).max(256),
    confirm: z.string().max(256),
  }),
  async (input) => {
    await requirePrincipal(); // the link in the email signed the person in for this one step
    if (input.password !== input.confirm) {
      return {
        message: "The two passwords are not the same.",
        fields: { confirm: "Not the same." },
      };
    }
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser({
      password: input.password,
    });
    if (error) return { message: resetMessage(error) };
    await supabase.auth.signOut({ scope: "others" }); // a password change ends every other session
    return redirect(await routeAfterSignIn("/"));
  },
);

export const changePassword = publicAction(
  z.strictObject({
    current: z.string().min(1).max(256),
    password: z.string().min(12).max(256),
    confirm: z.string().max(256),
  }),
  async (input): Promise<FormState> => {
    await requirePrincipal();
    if (input.password !== input.confirm) {
      return {
        message: "The two passwords are not the same.",
        fields: { confirm: "Not the same." },
      };
    }
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser({
      password: input.password,
      current_password: input.current,
    });
    if (error) {
      return error.code === "invalid_credentials" ||
        error.code === "current_password_mismatch"
        ? {
            message: "Your current password is not right.",
            fields: { current: "Not right." },
          }
        : { message: resetMessage(error) };
    }
    await supabase.auth.signOut({ scope: "others" });
    return {
      ok: true,
      message: "Your password is changed. Other devices were signed out.",
    };
  },
);

/** Start setting up an authenticator app: returns the QR image and the secret to type by hand. */
export const mfaStart = publicAction(z.strictObject({}), async () => {
  await requirePrincipal();
  const supabase = await supabaseServer();
  const { unverified } = await totpFactors(supabase);
  for (const factor of unverified)
    await supabase.auth.mfa.unenroll({ factorId: factor.id }); // an abandoned attempt
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator app ${new Date().toISOString().slice(0, 16)}`,
    issuer: "Minder",
  });
  if (error || !data) return { message: mfaMessage(error ?? {}) };
  return {
    ok: true,
    data: {
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
});

export const mfaConfirm = publicAction(
  z.strictObject({ factorId: z.uuid(), code, next }),
  async (input) => {
    await requirePrincipal();
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.code,
    });
    if (error)
      return { message: mfaMessage(error), fields: { code: "Not right." } };
    return redirect(safeNextPath(input.next));
  },
);

export const mfaChallenge = publicAction(
  z.strictObject({ code, next }),
  async (input) => {
    await requirePrincipal();
    const supabase = await supabaseServer();
    const { verified } = await totpFactors(supabase);
    const factor = verified[0];
    if (!factor)
      return redirect(
        `/mfa/enroll?next=${encodeURIComponent(safeNextPath(input.next))}`,
      );
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: input.code,
    });
    if (error)
      return { message: mfaMessage(error), fields: { code: "Not right." } };
    return redirect(safeNextPath(input.next));
  },
);

export const signOut = publicAction(
  z.strictObject({ scope: z.enum(["local", "global"]).optional() }),
  async (input) => {
    const supabase = await supabaseServer();
    await supabase.auth.signOut({ scope: input.scope ?? "local" });
    return redirect("/sign-in");
  },
);
