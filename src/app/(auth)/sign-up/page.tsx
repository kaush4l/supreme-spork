import { Link } from "@astryxdesign/core/Link";
import { captchaProps } from "@/server/captcha";
import { AuthForm } from "../_components/auth-form";
import { AuthShell } from "../_components/auth-shell";
import { signUp } from "../actions";

export const metadata = { title: "Create an account" };

export default async function SignUpPage() {
  return (
    <AuthShell
      title="Create an account"
      subtitle="Your password needs at least 12 characters. Any characters are fine."
      footer={
        <>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </>
      }
    >
      <AuthForm
        action={signUp}
        submitLabel="Create account"
        captcha={await captchaProps()}
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
            autoComplete: "new-password",
          },
          {
            name: "confirm",
            label: "Type the password again",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />
    </AuthShell>
  );
}
