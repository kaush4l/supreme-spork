import { safeNextPath } from "@/server/auth/next-path";
import { requirePrincipal } from "@/server/auth/principal";
import { recoveryStatus } from "@/server/auth/recovery";
import { AuthShell } from "../../_components/auth-shell";
import { RecoveryCodes } from "./recovery-codes";

export const metadata = { title: "Recovery codes" };

export default async function RecoveryCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const principal = await requirePrincipal();
  const next = safeNextPath((await searchParams).next);
  const status = await recoveryStatus(principal.accessToken);
  return (
    <AuthShell
      title="Save your recovery codes"
      subtitle="If you lose your phone, a recovery code is the way back in. They are shown once."
    >
      <RecoveryCodes next={next} remaining={status?.remaining ?? null} />
    </AuthShell>
  );
}
