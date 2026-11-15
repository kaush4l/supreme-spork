import { Link } from "@astryxdesign/core/Link";
import { safeNextPath } from "@/server/auth/next-path";
import { captchaProps } from "@/server/captcha";
import { AuthForm } from "../_components/auth-form";
import { AuthShell } from "../_components/auth-shell";
import { signIn } from "../actions";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; confirmed?: string }>;
}) {
  const { next, confirmed } = await searchParams;
  return (
    <AuthShell
      title="Sign in"
      subtitle={
        confirmed
          ? "Your email address is confirmed. Sign in to continue."
          : "Use your email address and password."
      }
      footer={
        <>
          New here? <Link href="/sign-up">Create an account</Link> ·{" "}
          <Link href="/forgot-password">Forgot your password?</Link>
        </>
      }
    >
      <AuthForm
        action={signIn}
        submitLabel="Sign in"
        captcha={await captchaProps()}
        hidden={{ next: safeNextPath(next) }}
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "username",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
      />
    </AuthShell>
  );
}
