import { Link } from "@astryxdesign/core/Link";
import { AuthForm } from "@/app/(auth)/_components/auth-form";
import { AuthShell } from "@/app/(auth)/_components/auth-shell";
import { changePassword } from "@/app/(auth)/actions";
import { requirePrincipal } from "@/server/auth/principal";

export const metadata = { title: "Change your password" };

export default async function ChangePasswordPage() {
  await requirePrincipal();
  return (
    <AuthShell
      title="Change your password"
      subtitle="At least 12 characters. Other devices will be signed out."
      footer={<Link href="/">Back</Link>}
    >
      <AuthForm
        action={changePassword}
        submitLabel="Change password"
        fields={[
          {
            name: "current",
            label: "Current password",
            type: "password",
            autoComplete: "current-password",
          },
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
          },
          {
            name: "confirm",
            label: "Type the new password again",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />
    </AuthShell>
  );
}
