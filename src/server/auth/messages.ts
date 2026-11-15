/**
 * What a person is told when a sign-in, sign-up or reset call fails. Three rules: never say whether an address has an
 * account (an attacker could list customers), never repeat what the person typed, and never pass the service's own
 * text through (it can name internals). Each message is chosen from the error's code and status only.
 */
export type AuthFailure = {
  code?: string | null;
  status?: number | null;
  message?: string | null;
};

export function signInMessage(failure: AuthFailure): string {
  if (failure.status === 429 || failure.code === "over_request_rate_limit") {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (failure.code === "email_not_confirmed") {
    return "Confirm your email address first. We sent you a link when you signed up.";
  }
  if (failure.code === "invalid_credentials") {
    // The lockout answers with the same code and its own sentence; say that, and nothing more.
    if (/too many/i.test(failure.message ?? ""))
      return "Too many attempts. Wait a few minutes and try again.";
    return "That email and password do not match.";
  }
  if (failure.code === "captcha_failed")
    return "We could not check that you are a person. Try again.";
  return "We could not sign you in. Try again in a moment.";
}

export function signUpMessage(failure: AuthFailure): string {
  if (
    failure.status === 429 ||
    failure.code === "over_request_rate_limit" ||
    failure.code === "over_email_send_rate_limit"
  ) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (failure.code === "weak_password") {
    return "Choose a password of at least 12 characters that is not a common one.";
  }
  if (failure.code === "captcha_failed")
    return "We could not check that you are a person. Try again.";
  return "We could not create the account. Check the details and try again.";
}

export function resetMessage(failure: AuthFailure): string {
  if (
    failure.status === 429 ||
    failure.code === "over_request_rate_limit" ||
    failure.code === "over_email_send_rate_limit"
  ) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (failure.code === "weak_password") {
    return "Choose a password of at least 12 characters that is not a common one.";
  }
  if (failure.code === "same_password")
    return "Choose a password you have not used for this account.";
  if (failure.code === "captcha_failed")
    return "We could not check that you are a person. Try again.";
  return "We could not do that. Try again in a moment.";
}

export function mfaMessage(failure: AuthFailure): string {
  if (failure.status === 429 || failure.code === "over_request_rate_limit") {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (
    failure.code === "mfa_verification_failed" ||
    failure.code === "mfa_challenge_expired"
  ) {
    return "That code is not right, or it has expired. Open your authenticator app and try the new code.";
  }
  return "We could not check that code. Try again.";
}

/** Sent whatever the address: a person asking to reset, or signing up with an address that already has an account. */
export const RESET_SENT =
  "If that address has an account, we have sent it a link to choose a new password.";
export const SIGN_UP_SENT =
  "Check your email. We sent a link to confirm your address.";
