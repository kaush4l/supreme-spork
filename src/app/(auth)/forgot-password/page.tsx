import { Link } from "@astryxdesign/core/Link";
import { captchaProps } from "@/server/captcha";
import { AuthForm } from "../_components/auth-form";
import { AuthShell } from "../_components/auth-shell";
import { forgotPassword } from "../actions";

export const metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        expired
          ? "That link did not work or has expired. Ask for a new one."
          : "We will email you a link."
      }
      footer={<Link href="/sign-in">Back to sign in</Link>}
    >
      <AuthForm
        action={forgotPassword}
        submitLabel="Send the link"
        captcha={await captchaProps()}
        doneTitle="Check your email"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "username",
          },
        ]}
      />
    </AuthShell>
  );
}
