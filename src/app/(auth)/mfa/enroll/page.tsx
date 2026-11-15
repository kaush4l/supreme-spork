import { safeNextPath } from "@/server/auth/next-path";
import { requirePrincipal } from "@/server/auth/principal";
import { AuthShell } from "../../_components/auth-shell";
import { Enroll } from "./enroll";

export const metadata = { title: "Set up a second step" };

export default async function MfaEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requirePrincipal();
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Set up a second step"
      subtitle="Every account here needs a code from an authenticator app as well as a password."
    >
      <Enroll next={safeNextPath(next)} />
    </AuthShell>
  );
}
