import { Link } from "@astryxdesign/core/Link";
import { safeNextPath } from "@/server/auth/next-path";
import { requirePrincipal } from "@/server/auth/principal";
import { AuthForm } from "../../_components/auth-form";
import { AuthShell } from "../../_components/auth-shell";
import { recoveryUse } from "../../actions";

export const metadata = { title: "Use a recovery code" };

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requirePrincipal();
  const next = safeNextPath((await searchParams).next);
  return (
    <AuthShell
      title="Use a recovery code"
      subtitle="Lost your phone? Type one of the recovery codes you saved. Each code works once."
      footer={
        <Link href={`/mfa/challenge?next=${encodeURIComponent(next)}`}>
          Back to the authenticator code
        </Link>
      }
    >
      <AuthForm
        action={recoveryUse}
        submitLabel="Sign in with this code"
        hidden={{ next }}
        fields={[
          {
            name: "recovery",
            label: "Recovery code",
            autoComplete: "off",
            inputMode: "text",
          },
        ]}
      />
    </AuthShell>
  );
}
