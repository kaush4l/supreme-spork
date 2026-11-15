import { VStack } from "@astryxdesign/core/Layout";
import { Heading } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { clockLocation, rosterRules } from "@/server/data/settings";
import {
  openingHours,
  publicHolidays,
  venueSettings,
} from "@/server/data/venue-settings";
import { can } from "@/server/nav";
import { HolidaysCard } from "./holidays-card";
import { HoursCard } from "./hours-card";
import { LocationCard } from "./location-card";
import { RulesForm } from "./rules-form";
import { VenueCard } from "./venue-card";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { venueId } = await params;
  const { year: yearText } = await searchParams;
  const asked = /^\d{4}$/.test(yearText ?? "") ? Number(yearText) : undefined;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/settings`;
  const token = principal.accessToken;
  const [rights, rules, location, settings, hours, holidays] =
    await Promise.all([
      myRights(token, venueId, here),
      rosterRules(token, venueId, here),
      clockLocation(token, venueId, here),
      venueSettings(token, venueId, here),
      openingHours(token, venueId, here),
      publicHolidays(token, venueId, asked ?? new Date().getFullYear(), here),
    ]);
  const canEdit = can(rights, "roster.rules.change");
  const canEditVenue =
    rights.roles.includes("owner") || rights.roles.includes("partner");
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Settings</Heading>
      <VenueCard venueId={venueId} settings={settings} canEdit={canEditVenue} />
      <HoursCard venueId={venueId} days={hours.days} canEdit={canEditVenue} />
      <HolidaysCard
        key={holidays.year}
        venueId={venueId}
        year={holidays.year}
        holidays={holidays.holidays}
        canEdit={canEditVenue}
      />
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
