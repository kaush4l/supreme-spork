import { requirePrincipal } from "@/server/auth/principal";
import { AuthForm } from "../_components/auth-form";
import { AuthShell } from "../_components/auth-shell";
import { resetPassword } from "../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  await requirePrincipal(); // the link in the email signed this person in for this one step; anyone else goes to sign in
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="At least 12 characters. Other devices will be signed out."
    >
      <AuthForm
        action={resetPassword}
        submitLabel="Change password"
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
          },
          {
            name: "confirm",
            label: "Type it again",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />
    </AuthShell>
  );
}
