import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { requirePrincipal } from "@/server/auth/principal";

export const metadata = { title: "Venue" };

const rightsSchema = z.object({
  venue_id: z.string(),
  roles: z.array(z.string()),
  rights: z.array(z.string()),
  approval_limit_cents: z.number(),
});

export default async function VenuePage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const { data, error, response } = await backend(principal.accessToken).GET(
    "/v1/venues/{venue_id}/me/rights",
    {
      params: { path: { venue_id: venueId } },
    },
  );
  if (!response.ok) {
    const failure = toApiFailure(response.status, error);
    if (failure.needsSignIn) redirect("/sign-in");
    if (failure.code === "mfa_required")
      redirect(
        `/mfa/challenge?next=${encodeURIComponent(`/venues/${venueId}`)}`,
      );
    if (response.status === 403 || response.status === 404) notFound();
    throw failure;
  }
  const parsed = rightsSchema.safeParse(data);
  if (!parsed.success)
    throw new ApiFailure(
      502,
      "bad_answer",
      "The server sent an answer we did not expect.",
    );
  const mine = parsed.data;
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <Link href="/">All venues</Link>
      <Heading level={1}>Venue</Heading>
      <Card padding={4}>
        <VStack gap={1}>
          <Text type="body">Your role here: {mine.roles.join(", ")}</Text>
          <Text type="supporting" color="secondary">
            {mine.rights.length === 0
              ? "You have no management rights here."
              : `Your rights: ${mine.rights.join(", ")}`}
          </Text>
          {mine.roles.some((role) => role === "owner" || role === "partner") ? (
            <Link href={`/venues/${venueId}/rules`}>Who can do what</Link>
          ) : null}
        </VStack>
      </Card>
    </VStack>
  );
}
