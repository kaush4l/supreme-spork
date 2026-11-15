import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myClock, myLists, myShifts } from "@/server/data/me";
import { formatDay, formatSpan, formatTime } from "@/server/format";
import { ClockCard } from "./clock-card";

export const metadata = { title: "Today" };

const LIST_WORDS: Record<string, string> = {
  open: "To do",
  overdue: "Overdue",
  missed: "Not done",
  done: "Done",
};

export default async function TodayPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/today`;
  const token = principal.accessToken;
  const [me, clock, shifts, lists] = await Promise.all([
    fetchMe(backend(token)),
    myClock(token, venueId, here),
    myShifts(token, venueId, here),
    myLists(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const now = Date.now();
  const next = shifts.find((s) => new Date(s.end).getTime() > now);
  const open = lists.filter((l) => l.status !== "done");
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Today</Heading>
      <ClockCard
        venueId={venueId}
        clockedIn={clock.clocked_in}
        sinceLabel={clock.since ? formatTime(clock.since, tz) : null}
        method={clock.method}
        shiftLabel={
          next
            ? `${formatDay(next.start, tz)}, ${formatSpan(next.start, next.end, tz)}${next.position ? ` (${next.position})` : ""}`
            : null
        }
      />
      <Card padding={4}>
        <VStack gap={2}>
          <Heading level={2}>My checklists</Heading>
          {lists.length === 0 ? (
            <Text type="supporting" color="secondary">
              Nothing to do right now.
            </Text>
          ) : (
            lists.map((l) => (
              <Link key={l.id} href={`/venues/${venueId}/lists/${l.id}`}>
                {l.name} · {LIST_WORDS[l.status]}, due {formatDay(l.due_at, tz)}{" "}
                {formatTime(l.due_at, tz)}
              </Link>
            ))
          )}
          {open.length > 0 ? (
            <Text type="supporting" color="secondary">
              {open.length} still to finish.
            </Text>
          ) : null}
        </VStack>
      </Card>
      <Link href={`/venues/${venueId}/shifts`}>All my shifts</Link>
    </VStack>
  );
}
