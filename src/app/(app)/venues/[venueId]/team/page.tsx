import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { listInvites, listPositions, listStaff } from "@/server/data/team";
import { formatMoney } from "@/server/format";
import { can } from "@/server/nav";
import { InvitesCard } from "./invites-card";
import { type Person, PersonCard } from "./person-card";
import { PersonForm } from "./person-form";
import { PositionsCard } from "./positions-card";

export const metadata = { title: "Team" };

const ROLE_WORDS: Record<string, string> = {
  staff: "Staff",
  manager: "Manager",
  partner: "Partner",
  bookkeeper: "Bookkeeper",
};
const INVITE_WORDS: Record<string, string> = {
  open: "Waiting",
  declined: "Said no",
  expired: "Expired",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/team`;
  const token = principal.accessToken;
  const rights = await myRights(token, venueId, here);
  const manage = can(rights, "staff.manage");
  const invite = can(rights, "staff.invite");
  if (!manage && !invite) notFound();
  const canPay = can(rights, "staff.pay.change");
  const [staff, positions, invites] = await Promise.all([
    manage ? listStaff(token, venueId, here) : Promise.resolve([]),
    listPositions(token, venueId, here),
    invite ? listInvites(token, venueId, here) : Promise.resolve([]),
  ]);
  const activePositions = positions.filter((p) => p.active);
  const people: Person[] = staff.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    positions: s.position_names,
    active: s.active,
    hasLogin: s.has_login,
    rateCents: canPay ? s.hourly_cost_cents : null,
    rateLabel:
      canPay && s.hourly_cost_cents !== null
        ? `${formatMoney(s.hourly_cost_cents)} an hour`
        : null,
    endedLabel: s.ended_on ?? null,
    userId: s.user_id ?? null,
  }));
  const working = people.filter((p) => p.active);
  const left = people.filter((p) => !p.active);
  const card = (p: Person) => (
    <PersonCard
      key={p.id}
      venueId={venueId}
      person={p}
      positionNames={activePositions.map((x) => x.name)}
      canPay={canPay}
      canEdit={manage}
      canInvite={invite}
      canEnd={can(rights, "staff.employment.end")}
      canResetSecondFactor={can(rights, "staff.mfa.reset")}
    />
  );
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Team</Heading>
      <Banner
        status="info"
        title="Everyone needs an email and a phone to sign in"
        description="When you invite someone, we send the invite to their email. They accept it after they sign in."
      />
      {manage || can(rights, "roster.build") ? (
        <HStack gap={3} wrap="wrap">
          {manage ? (
            <Link href={`/venues/${venueId}/team/unlinked`}>
              People not on the team
            </Link>
          ) : null}
          {can(rights, "roster.build") ? (
            <>
              <Link href={`/venues/${venueId}/team/groups`}>Staff groups</Link>
              <Link href={`/venues/${venueId}/team/blackouts`}>
                Leave blackout dates
              </Link>
            </>
          ) : null}
        </HStack>
      ) : null}
      {manage ? (
        <>
          <Heading level={2}>Working here</Heading>
          {working.length === 0 ? (
            <Text type="supporting" color="secondary">
              Nobody on the team yet. Add the first person below.
            </Text>
          ) : (
            working.map(card)
          )}
          <Card padding={4}>
            <VStack gap={3} hAlign="stretch">
              <Heading level={2}>Add a person</Heading>
              <PersonForm
                venueId={venueId}
                positionNames={activePositions.map((p) => p.name)}
                canPay={canPay}
              />
            </VStack>
          </Card>
          <PositionsCard
            venueId={venueId}
            canPay={canPay}
            positions={activePositions.map((p) => ({
              id: p.id,
              name: p.name,
              rateLabel:
                canPay && p.default_rate_cents !== undefined
                  ? `${formatMoney(p.default_rate_cents)} an hour`
                  : null,
            }))}
          />
        </>
      ) : null}
      {invite ? (
        <InvitesCard
          venueId={venueId}
          invites={invites.map((i) => ({
            id: i.id,
            email: i.email,
            roleLabel: ROLE_WORDS[i.role] ?? i.role,
            status: i.status,
            statusLabel: INVITE_WORDS[i.status] ?? i.status,
          }))}
        />
      ) : null}
      {left.length > 0 ? (
        <>
          <Heading level={2}>Left</Heading>
          {left.map(card)}
        </>
      ) : null}
    </VStack>
  );
}
