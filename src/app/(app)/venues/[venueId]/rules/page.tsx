import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { requirePrincipal } from "@/server/auth/principal";
import { ApprovalRules } from "./approval-rules";
import { RulesTable } from "./rules-table";

export const metadata = { title: "Who can do what" };

const listing = z.object({
  categories: z.array(z.object({ key: z.string(), label: z.string() })),
  grantable_roles: z.array(z.string()),
  items: z.array(
    z.object({
      key: z.string(),
      category: z.string(),
      label: z.string(),
      help: z.string(),
      default_roles: z.array(z.string()),
      roles: z.array(z.string()),
      changed: z.boolean(),
    }),
  ),
});

export default async function RulesPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const { data, error, response } = await backend(principal.accessToken).GET(
    "/v1/venues/{venue_id}/permissions",
    {
      params: { path: { venue_id: venueId } },
    },
  );
  if (!response.ok) {
    const failure = toApiFailure(response.status, error);
    if (failure.needsSignIn) redirect("/sign-in");
    if (failure.code === "mfa_required")
      redirect(
        `/mfa/challenge?next=${encodeURIComponent(`/venues/${venueId}/rules`)}`,
      );
    if (response.status === 403 || response.status === 404) notFound(); // only the owner and a partner may open this
    throw failure;
  }
  const parsed = listing.safeParse(data);
  if (!parsed.success)
    throw new ApiFailure(
      502,
      "bad_answer",
      "The server sent an answer we did not expect.",
    );
  // The page needs the caller's own role to know whether the switches work; the backend decides anyway.
  const rights = await backend(principal.accessToken).GET(
    "/v1/venues/{venue_id}/me/rights",
    {
      params: { path: { venue_id: venueId } },
    },
  );
  const roles = z.object({ roles: z.array(z.string()) }).safeParse(rights.data);
  const isOwner = roles.success && roles.data.roles.includes("owner");
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <Link href={`/venues/${venueId}`}>Back to the venue</Link>
      <VStack gap={1}>
        <Heading level={1}>Who can do what</Heading>
        <Text type="body" color="secondary">
          The owner always has every right. Staff never have management rights;
          make them a manager instead.
        </Text>
      </VStack>
      <RulesTable
        venueId={venueId}
        rights={parsed.data.items}
        categories={parsed.data.categories}
        grantable={parsed.data.grantable_roles}
        canEdit={isOwner}
      />
      <ApprovalRules venueId={venueId} />
    </VStack>
  );
}
