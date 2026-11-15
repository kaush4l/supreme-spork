import { Badge } from "@astryxdesign/core/Badge";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import {
  getAvailability,
  getStaffPerson,
  listCertificates,
} from "@/server/data/team-extras";
import { can } from "@/server/nav";
import { AvailabilityCard } from "./availability-card";
import { CertificatesCard } from "./certificates-card";
import { UnlinkButton } from "./unlink-button";

export const metadata = { title: "Team member" };

export default async function PersonPage({
  params,
}: {
  params: Promise<{ venueId: string; staffId: string }>;
}) {
  const { venueId, staffId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(staffId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/team/${staffId}`;
  const token = principal.accessToken;
  const rights = await myRights(token, venueId, here);
  if (!can(rights, "staff.manage")) notFound();
  const showCerts = can(rights, "certificates.record");
  const showAvailability = can(rights, "roster.build");
  const [person, certs, availability] = await Promise.all([
    getStaffPerson(token, venueId, staffId, here),
    showCerts ? listCertificates(token, venueId, staffId, here) : null,
    showAvailability ? getAvailability(token, venueId, staffId, here) : null,
  ]);
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/team`}>Back to the team</Link>
      <Heading level={1}>{person.name}</Heading>
      <HStack gap={2} wrap="wrap">
        <Badge
          label={person.active ? "Working here" : "Left"}
          variant={person.active ? "success" : "neutral"}
        />
        <Badge
          label={person.has_login ? "Can sign in" : "No login yet"}
          variant={person.has_login ? "info" : "warning"}
        />
      </HStack>
      <Text type="supporting" color="secondary">
        {person.email ?? "No email yet"}
        {person.position_names.length > 0
          ? ` · ${person.position_names.join(", ")}`
          : ""}
      </Text>
      {person.has_login ? (
        <UnlinkButton venueId={venueId} staffId={staffId} name={person.name} />
      ) : null}
      {certs ? (
        <CertificatesCard venueId={venueId} staffId={staffId} items={certs} />
      ) : null}
      {availability ? (
        <AvailabilityCard
          venueId={venueId}
          staffId={staffId}
          owner={availability.owner}
          rows={availability.items}
        />
      ) : null}
    </VStack>
  );
}
