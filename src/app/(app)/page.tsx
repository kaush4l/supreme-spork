import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { redirect } from "next/navigation";
import { SignOutForm } from "@/app/(auth)/_components/sign-out-form";
import { backend } from "@/server/api/backend";
import { ApiFailure } from "@/server/api/errors";
import { fetchMe } from "@/server/api/me";
import { totpFactors } from "@/server/auth/flows";
import { requirePrincipal } from "@/server/auth/principal";
import { supabaseServer } from "@/server/auth/supabase";
import { Invites } from "./_components/invites";

export const metadata = { title: "Your venues" };

export default async function HomePage() {
  const principal = await requirePrincipal();
  const me = await fetchMe(backend(principal.accessToken)).catch((error) => {
    if (error instanceof ApiFailure && error.needsSignIn) redirect("/sign-in");
    throw error;
  });
  // A role that needs a second factor gets no further until it has passed one.
  if (me.mfa.required && me.mfa.level !== "aal2") {
    const { verified } = await totpFactors(await supabaseServer());
    redirect(
      `/mfa/${verified.length > 0 ? "challenge" : "enroll"}?next=${encodeURIComponent("/")}`,
    );
  }
  return (
    <VStack gap={5} padding={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>Your venues</Heading>
        <Text type="body" color="secondary">
          Signed in as {principal.email ?? "you"}
        </Text>
      </VStack>

      <Invites invites={me.pending_invites} />

      {me.venues.length === 0 ? (
        <Card padding={6}>
          <VStack gap={2}>
            <Text type="body">
              You are not part of a venue yet. Accept an invitation, or set one
              up.
            </Text>
            <Link href="/venues/new">Set up a venue</Link>
          </VStack>
        </Card>
      ) : (
        <VStack gap={2} hAlign="stretch">
          {me.venues.map((venue) => {
            const roles = me.memberships.filter(
              (m) =>
                m.venue_id === venue.id ||
                (m.venue_id === null && m.org_id === venue.org_id),
            );
            return (
              <Card key={venue.id} padding={4}>
                <VStack gap={1}>
                  <Link href={`/venues/${venue.id}`}>{venue.name}</Link>
                  <Text type="supporting" color="secondary">
                    {[...new Set(roles.map((r) => r.role))].join(", ")}
                  </Text>
                </VStack>
              </Card>
            );
          })}
          <Link href="/venues/new">Set up another venue</Link>
        </VStack>
      )}

      <VStack gap={1} hAlign="start">
        <Link href="/account/password">Change your password</Link>
        <SignOutForm label="Sign out of this device" />
        <SignOutForm label="Sign out everywhere" scope="global" />
      </VStack>
    </VStack>
  );
}
