import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { todayBoard } from "@/server/data/board";
import { formatDay, formatSpan, formatTime } from "@/server/format";
import {
  lateWords,
  overdueFirst,
  progressWords,
  rangeWords,
  statusWord,
} from "../lists/words";
import { DayPicker } from "./day-picker";

export const metadata = { title: "Today board" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ day?: string | string[] }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const { day: rawDay } = await searchParams;
  const day =
    typeof rawDay === "string" && DAY.test(rawDay) ? rawDay : undefined;
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/board`;
  const token = principal.accessToken;
  const [me, board] = await Promise.all([
    fetchMe(backend(token)),
    todayBoard(token, venueId, day, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const c = board.counts;
  const link = (id: string) => `/venues/${venueId}/board/${id}`;
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Today board</Heading>
      <DayPicker venueId={venueId} day={board.day} />
      <Text type="body">
        {formatDay(`${board.day}T12:00:00Z`, "UTC")} · {c.lists}{" "}
        {c.lists === 1 ? "list" : "lists"}: {c.done} done, {c.open} to do,{" "}
        {c.overdue} overdue, {c.missed} not done
      </Text>
      <Text type="supporting" color="secondary">
        {c.out_of_range} {c.out_of_range === 1 ? "reading" : "readings"} outside
        range · {c.photos} {c.photos === 1 ? "photo" : "photos"} · as of{" "}
        {formatTime(board.generated_at, tz)}
      </Text>

      {board.overdue.length > 0 ? (
        <Card padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={2}>Needs attention</Heading>
            {board.overdue.map((o) => (
              <VStack key={o.list_id} gap={1} hAlign="start">
                <Link href={link(o.list_id)}>
                  {o.list}, {o.staff}
                </Link>
                <Text type="supporting" color="secondary">
                  {statusWord(o.status)}, due {formatTime(o.due_at, tz)},{" "}
                  {lateWords(o.minutes_late)}
                </Text>
              </VStack>
            ))}
          </VStack>
        </Card>
      ) : null}

      {board.out_of_range.length > 0 ? (
        <Card padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={2}>Readings outside range</Heading>
            {board.out_of_range.map((r) => (
              <VStack key={`${r.list_id}-${r.item_key}`} gap={1} hAlign="start">
                <Link href={link(r.list_id)}>
                  {r.label}: {r.value}
                </Link>
                <Text type="supporting" color="secondary">
                  Expected{" "}
                  {rangeWords(r.min_value, r.max_value) ?? "a set range"},{" "}
                  {r.staff}, {r.list}
                  {r.answered_at ? `, ${formatTime(r.answered_at, tz)}` : ""}
                </Text>
              </VStack>
            ))}
          </VStack>
        </Card>
      ) : null}

      <Heading level={2}>Who is on</Heading>
      {board.shifts.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nobody is rostered and no lists were issued for this day.
        </Text>
      ) : (
        board.shifts.map((s) => (
          <Card key={s.shift_external_id} padding={4}>
            <VStack gap={2} hAlign="stretch">
              <Text type="large">{s.staff}</Text>
              <Text type="supporting" color="secondary">
                {s.start && s.end ? formatSpan(s.start, s.end, tz) : "No shift"}
                {s.position ? ` · ${s.position}` : ""}
              </Text>
              {s.lists.length === 0 ? (
                <Text type="supporting" color="secondary">
                  No checklist yet.
                </Text>
              ) : (
                overdueFirst(s.lists).map((l) => (
                  <VStack key={l.id} gap={1} hAlign="start">
                    <Link href={link(l.id)}>{l.name}</Link>
                    <Badge
                      label={statusWord(l.status)}
                      variant={
                        l.status === "done"
                          ? "success"
                          : l.status === "open"
                            ? "neutral"
                            : "warning"
                      }
                    />
                    <Text type="supporting" color="secondary">
                      Due {formatTime(l.due_at, tz)} ·{" "}
                      {progressWords(l.progress)}
                      {l.photos.length > 0
                        ? ` · ${l.photos.length} ${l.photos.length === 1 ? "photo" : "photos"}`
                        : ""}
                    </Text>
                  </VStack>
                ))
              )}
            </VStack>
          </Card>
        ))
      )}
    </VStack>
  );
}
