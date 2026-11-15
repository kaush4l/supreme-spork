import { VStack } from "@astryxdesign/core/Layout";
import { Heading } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { clockLocation, rosterRules } from "@/server/data/settings";
import { can } from "@/server/nav";
import { LocationCard } from "./location-card";
import { RulesForm } from "./rules-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/settings`;
  const token = principal.accessToken;
  const [rights, rules, location] = await Promise.all([
    myRights(token, venueId, here),
    rosterRules(token, venueId, here),
    clockLocation(token, venueId, here),
  ]);
  const canEdit = can(rights, "roster.rules.change");
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Settings</Heading>
      <RulesForm
        key={JSON.stringify(rules.items.map((r) => r.value))}
        venueId={venueId}
        rules={rules}
        canEdit={canEdit}
      />
      <LocationCard
        venueId={venueId}
        latitude={location.latitude}
        longitude={location.longitude}
        canEdit={canEdit}
      />
    </VStack>
  );
}
