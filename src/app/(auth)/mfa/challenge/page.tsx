import { Link } from "@astryxdesign/core/Link";
import { safeNextPath } from "@/server/auth/next-path";
import { requirePrincipal } from "@/server/auth/principal";
import { AuthForm } from "../../_components/auth-form";
import { AuthShell } from "../../_components/auth-shell";
import { SignOutForm } from "../../_components/sign-out-form";
import { mfaChallenge } from "../../actions";

export const metadata = { title: "Confirm it is you" };

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requirePrincipal();
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Confirm it is you"
      subtitle="Open your authenticator app and type the 6-digit code for this account."
      footer={
        <>
          <Link
            href={`/mfa/recovery?next=${encodeURIComponent(safeNextPath(next))}`}
          >
            Lost your phone? Use a recovery code
          </Link>
          <SignOutForm label="Use a different account" />
        </>
      }
    >
      <AuthForm
        action={mfaChallenge}
        submitLabel="Confirm"
        hidden={{ next: safeNextPath(next) }}
        fields={[
          {
            name: "code",
            label: "6-digit code",
            autoComplete: "one-time-code",
            inputMode: "numeric",
          },
        ]}
      />
    </AuthShell>
  );
}
