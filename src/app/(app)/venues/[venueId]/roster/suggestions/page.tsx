import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { rosterGrid } from "@/server/data/roster";
import { rosterSuggestions } from "@/server/data/roster-extras";
import { formatDay, formatHours, formatSpan } from "@/server/format";
import { addDays, parseWeek } from "../week";
import { SuggestionList } from "./suggestion-list";

export const metadata = { title: "Suggestions" };

export default async function SuggestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/roster/suggestions`;
  const asked = parseWeek((await searchParams).week);
  // With no week in the address the backend names the current one.
  const week =
    asked ?? (await rosterGrid(token, venueId, null, here)).week_start;
  const [me, s] = await Promise.all([
    fetchMe(backend(token)),
    rosterSuggestions(token, venueId, week, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const base = `${here}?week=`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Suggestions</Heading>
      <Link href={`/venues/${venueId}/roster?week=${week}`}>
        Back to the roster
      </Link>
      <HStack gap={3} justify="between" wrap="wrap">
        <Link href={`${base}${addDays(week, -7)}`}>Previous week</Link>
        <Text type="body">Week of {formatDay(`${week}T12:00:00Z`, "UTC")}</Text>
        <Link href={`${base}${addDays(week, 7)}`}>Next week</Link>
      </HStack>
      <Text type="supporting" color="secondary">
        For each open shift, the people who could work it, best first, with the
        reasons. Nothing changes until you choose and fill.
      </Text>
      {s.items.length === 0 ? (
        <Text type="body" color="secondary">
          This week has no open shifts.
        </Text>
      ) : (
        <SuggestionList
          venueId={venueId}
          week={week}
          lines={s.items.map((i) => ({
            id: i.shift.external_id,
            title: i.shift.position ?? "Shift",
            when: `${formatDay(i.shift.start, tz)}, ${formatSpan(i.shift.start, i.shift.end, tz)}`,
            hoursLabel:
              i.shift.hours == null ? null : formatHours(i.shift.hours),
            candidates: i.candidates.map((c) => ({
              staffId: c.staff_id,
              name: c.name,
              reasons: c.reasons.join(". "),
            })),
            skipped: i.skipped.map((k) => ({
              name: k.name,
              reasons: k.reasons.join(". "),
            })),
          }))}
        />
      )}
    </VStack>
  );
}
