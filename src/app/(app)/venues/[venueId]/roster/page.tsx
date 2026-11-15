import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import {
  currentWeek,
  type RosterGrid,
  rosterGrid,
  rosterPeople,
  rosterPositions,
  rosterPublished,
} from "@/server/data/roster";
import { formatDay, formatSpan } from "@/server/format";
import { can } from "@/server/nav";
import { RosterBoard } from "./roster-board";
import type { ShiftView } from "./types";
import {
  addDays,
  groupByDay,
  parseWeek,
  toLocalInput,
  weekDates,
} from "./week";

export const metadata = { title: "Roster" };

/** Ids of shifts that are not in the published version yet, as the builder lists them. */
function unpublishedIds(grid: RosterGrid): Set<string> {
  const all = new Set<string>();
  if (grid.state === "not_published") {
    for (const s of grid.shifts) all.add(s.external_id);
    return all;
  }
  const c = grid.unpublished_changes;
  if (c) for (const s of [...c.added, ...c.changed]) all.add(s.external_id);
  return all;
}

function changesLabel(grid: RosterGrid): string | null {
  if (grid.state === "not_published") return "This week is not published yet.";
  if (grid.state !== "changed_since_publish") return null;
  const c = grid.unpublished_changes;
  if (!c) return "There are changes that are not published yet.";
  const bits = [
    c.added.length ? `${c.added.length} added` : "",
    c.changed.length ? `${c.changed.length} changed` : "",
    c.removed.length ? `${c.removed.length} removed` : "",
  ].filter(Boolean);
  return `Not published yet: ${bits.join(", ")}.`;
}

export default async function RosterPage({
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
  const here = `/venues/${venueId}/roster`;
  const asked = parseWeek((await searchParams).week);
  const [me, rights, week] = await Promise.all([
    fetchMe(backend(token)),
    myRights(token, venueId, here),
    asked ?? currentWeek(token, venueId),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const [grid, published, positions, people] = await Promise.all([
    rosterGrid(token, venueId, week, here),
    rosterPublished(token, venueId, week, here),
    rosterPositions(token, venueId, here),
    rosterPeople(token, venueId),
  ]);

  const idByRef = new Map(people.map((p) => [p.staff_ref, p.id]));
  const draft = unpublishedIds(grid);
  const shifts = grid.shifts.map((s) => ({
    start: s.start,
    view: {
      id: s.external_id,
      position: s.position ?? "No position",
      staffId: s.staff_ref ? (idByRef.get(s.staff_ref) ?? null) : null,
      who: s.staff_name ?? "Open",
      span: formatSpan(s.start, s.end, tz),
      startInput: toLocalInput(s.start, tz),
      endInput: toLocalInput(s.end, tz),
      breakMinutes: s.break_minutes,
      published: !draft.has(s.external_id),
      warnings: grid.checks.warnings
        .filter((w) => w.external_ids.includes(s.external_id))
        .map((w) => ({ kind: w.kind, message: w.message })),
    } satisfies ShiftView,
  }));
  const dates = weekDates(week);
  const grouped = groupByDay(shifts, dates, tz);
  const label = (date: string) => formatDay(`${date}T12:00:00Z`, "UTC");
  const days = grouped.days.map((d) => ({
    date: d.date,
    label: label(d.date),
    shifts: d.shifts.map((s) => s.view),
  }));
  const base = `/venues/${venueId}/roster?week=`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Roster</Heading>
      <HStack gap={3} justify="between" wrap="wrap">
        <Link href={`${base}${addDays(week, -7)}`}>Previous week</Link>
        <Text type="body">
          {label(dates[0])} to {label(dates[6])}
        </Text>
        <Link href={`${base}${addDays(week, 7)}`}>Next week</Link>
      </HStack>
      <RosterBoard
        venueId={venueId}
        week={week}
        days={days}
        extra={grouped.extra.map((s) => s.view)}
        positions={positions.filter((p) => p.active).map((p) => p.name)}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        canPublish={can(rights, "roster.publish")}
        hasShifts={grid.shifts.length > 0}
        changesLabel={changesLabel(grid)}
      />
      {grid.leave.length > 0 ? (
        <Card padding={4}>
          <VStack gap={2}>
            <Heading level={2}>On leave this week</Heading>
            {grid.leave.map((l) => (
              <Text key={`${l.staff_name}:${l.start_date}`} type="body">
                {l.staff_name ?? "Someone"}: {label(l.start_date)} to{" "}
                {label(l.end_date)}
              </Text>
            ))}
          </VStack>
        </Card>
      ) : null}
      <Card padding={4}>
        <VStack gap={2}>
          <Heading level={2}>Who has seen it</Heading>
          {published === null ? (
            <Text type="supporting" color="secondary">
              This week has not been published, so nobody has seen it.
            </Text>
          ) : (
            <>
              <Text type="supporting" color="secondary">
                Version {published.version}, published{" "}
                {formatDay(published.published_at, tz)}.
              </Text>
              {published.not_seen.length === 0 &&
              published.seen.length === 0 ? (
                <Text type="body">Nobody is on this version.</Text>
              ) : null}
              {published.not_seen.length > 0 ? (
                <Banner
                  status="warning"
                  title="Not seen yet"
                  description={published.not_seen
                    .map((p) =>
                      p.has_login ? p.name : `${p.name} (no login yet)`,
                    )
                    .join(", ")}
                />
              ) : null}
              {published.seen.length > 0 ? (
                <Text type="body">
                  Seen: {published.seen.map((p) => p.name).join(", ")}
                </Text>
              ) : null}
            </>
          )}
        </VStack>
      </Card>
    </VStack>
  );
}
