import { Badge } from "@astryxdesign/core/Badge";
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
import { fetchReviews, fetchTimeCheck } from "@/server/data/timecheck";
import { formatDay, formatTime } from "@/server/format";
import { can } from "@/server/nav";
import { chooseRange, todayIn } from "../range";
import { groupByKind, kindWords, minutesWords } from "./kinds";
import { RangeForm } from "./range-form";
import { SetAside } from "./set-aside";
import { SignOff } from "./sign-off";

export const metadata = { title: "Check hours" };

export default async function CheckHoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const me = await fetchMe(backend(token));
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const { from, to } = chooseRange(
    query.from,
    query.to,
    todayIn(new Date(), tz),
  );
  const here = `/venues/${venueId}/timesheet/check?from=${from}&to=${to}`;
  const [check, reviews, rights] = await Promise.all([
    fetchTimeCheck(token, venueId, from, to, here),
    fetchReviews(token, venueId, 20, here),
    myRights(token, venueId, here),
  ]);
  const mayCorrect = can(rights, "timesheet.correct");
  const groups = groupByKind(check.exceptions);

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Check hours</Heading>
      <Text type="supporting" color="secondary">
        The roster against the clock, before a pay run. Times within{" "}
        {check.tolerance_minutes} minutes of the roster are not counted.
      </Text>
      <RangeForm venueId={venueId} from={from} to={to} />
      {check.ready ? (
        <Banner
          status="success"
          title="Nothing is waiting"
          description={
            check.dismissed_count > 0
              ? `${check.dismissed_count} set aside. This period is ready to check.`
              : "This period is ready to check."
          }
        />
      ) : (
        <Banner
          status="warning"
          title={`${check.open_count} to look at before pay`}
          description={
            check.dismissed_count > 0
              ? `${check.dismissed_count} more set aside.`
              : undefined
          }
        />
      )}

      {groups.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nothing to look at between {from} and {to}.
        </Text>
      ) : null}
      {groups.map((g) => (
        <VStack key={g.kind} gap={2} hAlign="stretch">
          <Heading level={2}>
            {kindWords(g.kind)} ({check.counts[g.kind] ?? 0} open)
          </Heading>
          {g.rows.map((e) => (
            <Card key={e.key} padding={4}>
              <VStack gap={2} hAlign="stretch">
                <HStack gap={2} wrap="wrap">
                  <Heading level={3}>{e.name}</Heading>
                  {e.dismissed ? (
                    <Badge label="Set aside" variant="neutral" />
                  ) : null}
                </HStack>
                <Text type="body" color={e.dismissed ? "secondary" : undefined}>
                  {e.date}: {e.text}
                </Text>
                <Text type="supporting" color="secondary">
                  Planned {e.planned_minutes} min, worked{" "}
                  {e.actual_minutes === null
                    ? "not known yet"
                    : `${e.actual_minutes} min`}
                  {e.difference_minutes === null
                    ? ""
                    : ` (${minutesWords(e.difference_minutes)})`}
                </Text>
                {e.dismissed ? (
                  <Text type="supporting" color="secondary">
                    Set aside because: {e.dismissed_reason}
                  </Text>
                ) : null}
                {mayCorrect && !e.dismissed ? (
                  <HStack gap={4} wrap="wrap">
                    <Link
                      href={`/venues/${venueId}/timesheet?from=${e.date}&to=${e.date}`}
                    >
                      {e.clock_in_id || e.clock_out_id
                        ? "Correct the times"
                        : "Add the missing entry"}
                    </Link>
                  </HStack>
                ) : null}
                {mayCorrect && !e.dismissed ? (
                  <SetAside venueId={venueId} exceptionKey={e.key} />
                ) : null}
              </VStack>
            </Card>
          ))}
        </VStack>
      ))}

      {check.people.length > 0 ? (
        <VStack gap={2} hAlign="stretch">
          <Heading level={2}>By person</Heading>
          <Card padding={4}>
            <VStack gap={1} hAlign="stretch">
              {check.people.map((p) => (
                <Text key={p.staff_ref} type="supporting">
                  {p.name}: planned {p.planned_minutes} min, worked{" "}
                  {p.actual_minutes} min
                  {p.open_exceptions > 0
                    ? `, ${p.open_exceptions} to look at`
                    : ""}
                </Text>
              ))}
            </VStack>
          </Card>
        </VStack>
      ) : null}

      {mayCorrect ? (
        <SignOff
          venueId={venueId}
          from={from}
          to={to}
          openCount={check.open_count}
        />
      ) : null}

      <Heading level={2}>Earlier checks</Heading>
      {reviews.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No period has been marked checked yet.
        </Text>
      ) : (
        <Card padding={4}>
          <VStack gap={3} hAlign="stretch">
            {reviews.items.map((r) => (
              <VStack key={r.id} gap={1} hAlign="stretch">
                <Text type="body">
                  {r.from} to {r.to}, {r.open_count} open when checked
                </Text>
                <Text type="supporting" color="secondary">
                  {r.created_by_name ? `${r.created_by_name}, ` : ""}
                  {formatDay(r.created_at, tz)} {formatTime(r.created_at, tz)}
                </Text>
                {r.note ? <Text type="supporting">Note: {r.note}</Text> : null}
              </VStack>
            ))}
          </VStack>
        </Card>
      )}
      {reviews.total > reviews.items.length ? (
        <Text type="supporting" color="secondary">
          Showing the latest {reviews.items.length} of {reviews.total}.
        </Text>
      ) : null}
    </VStack>
  );
}
