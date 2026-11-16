import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { rosterGrid } from "@/server/data/roster";
import { type ChangeBrief, rosterHistory } from "@/server/data/roster-extras";
import { formatDay, formatSpan, formatTime } from "@/server/format";
import { addDays, parseWeek } from "../week";

export const metadata = { title: "Roster history" };

export default async function HistoryPage({
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
  const here = `/venues/${venueId}/roster/history`;
  const asked = parseWeek((await searchParams).week);
  const week =
    asked ?? (await rosterGrid(token, venueId, null, here)).week_start;
  const [me, versions] = await Promise.all([
    fetchMe(backend(token)),
    rosterHistory(token, venueId, week, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const base = `${here}?week=`;
  const line = (c: ChangeBrief) =>
    `${c.position ?? "Shift"}${c.staff_name ? `, ${c.staff_name}` : ", open"}: ${formatDay(c.start, tz)}, ${formatSpan(c.start, c.end, tz)}`;
  const groups = [
    ["added", "Added"],
    ["changed", "Changed"],
    ["removed", "Removed"],
  ] as const;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Roster history</Heading>
      <Link href={`/venues/${venueId}/roster?week=${week}`}>
        Back to the roster
      </Link>
      <HStack gap={3} justify="between" wrap="wrap">
        <Link href={`${base}${addDays(week, -7)}`}>Previous week</Link>
        <Text type="body">Week of {formatDay(`${week}T12:00:00Z`, "UTC")}</Text>
        <Link href={`${base}${addDays(week, 7)}`}>Next week</Link>
      </HStack>
      {versions.length === 0 ? (
        <Text type="body" color="secondary">
          This week has not been published, so there is no history yet.
        </Text>
      ) : (
        [...versions].reverse().map((v) => (
          <Card key={v.version} padding={4}>
            <VStack gap={2} hAlign="stretch">
              <Text type="body">
                Version {v.version}, published {formatDay(v.published_at, tz)}{" "}
                at {formatTime(v.published_at, tz)}
              </Text>
              <Text type="supporting" color="secondary">
                {v.shift_count} {v.shift_count === 1 ? "shift" : "shifts"} in
                this version
              </Text>
              {groups.map(([k, label]) => {
                const rows = v.changes?.[k] ?? [];
                if (rows.length === 0) return null;
                return (
                  <VStack key={k} gap={1} hAlign="stretch">
                    <Text type="body">
                      {label} ({rows.length})
                    </Text>
                    {rows.map((c) => (
                      <Text
                        key={`${k}:${c.external_id}`}
                        type="supporting"
                        color="secondary"
                      >
                        {line(c)}
                      </Text>
                    ))}
                  </VStack>
                );
              })}
            </VStack>
          </Card>
        ))
      )}
    </VStack>
  );
}
