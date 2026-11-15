import { Link } from "@astryxdesign/core/Link";
import { AuthForm } from "@/app/(auth)/_components/auth-form";
import { AuthShell } from "@/app/(auth)/_components/auth-shell";
import { newIdempotencyKey } from "@/server/api/idempotency";
import { requirePrincipal } from "@/server/auth/principal";
import { createVenue } from "../../actions";

export const metadata = { title: "Set up a venue" };

export default async function NewVenuePage() {
  await requirePrincipal();
  return (
    <AuthShell
      title="Set up a venue"
      subtitle="You become its owner. You can invite your team afterwards."
      footer={<Link href="/">Back</Link>}
    >
      <AuthForm
        action={createVenue}
        submitLabel="Set up venue"
        hidden={{ key: newIdempotencyKey() }}
        fields={[
          { name: "name", label: "Venue name", autoComplete: "organization" },
        ]}
      />
    </AuthShell>
  );
}
