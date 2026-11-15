import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { issuedLists, staffNames } from "@/server/data/checklists";
import { formatDay, formatTime } from "@/server/format";
import { isDay, todayIn, weekOf } from "../../timesheet/range";
import { IssueNow } from "./issue-now";
import { RangeForm } from "./range-form";

export const metadata = { title: "Issued lists" };

export default async function IssuedListsPage({
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
  const range =
    isDay(query.from) && isDay(query.to) && query.from <= query.to
      ? { from: query.from, to: query.to }
      : null;
  const here = `/venues/${venueId}/checklists/issued${range ? `?from=${range.from}&to=${range.to}` : ""}`;
  const [lists, names] = await Promise.all([
    issuedLists(token, venueId, range, here),
    staffNames(token, venueId, here),
  ]);
  const days = [...new Set(lists.items.map((l) => l.trading_day))].sort();
  const thisWeek = weekOf(range?.from ?? todayIn(new Date(), tz)).from;

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/checklists`}>All checklists</Link>
      <Heading level={1}>Issued lists</Heading>
      <Text type="supporting" color="secondary">
        The checklists given out to people for their shifts, by day.
      </Text>
      <RangeForm
        venueId={venueId}
        from={range?.from ?? ""}
        to={range?.to ?? ""}
      />
      <Text type="body">
        {range
          ? `${lists.total} ${lists.total === 1 ? "list" : "lists"} from ${range.from} to ${range.to}`
          : `${lists.total} ${lists.total === 1 ? "list" : "lists"} in all`}
        {lists.total > lists.items.length
          ? `. Showing the first ${lists.items.length}: choose dates to narrow it.`
          : ""}
      </Text>
      {lists.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No lists were issued
          {range ? ` between ${range.from} and ${range.to}` : " yet"}.
        </Text>
      ) : null}
      {days.map((day) => (
        <Card key={day} padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={3}>{formatDay(`${day}T12:00:00Z`, "UTC")}</Heading>
            {lists.items
              .filter((l) => l.trading_day === day)
              .map((l) => (
                <VStack key={l.id} gap={1} hAlign="start">
                  <Link href={`/venues/${venueId}/board/${l.id}`}>
                    {l.name},{" "}
                    {(l.staff_ref ? names.get(l.staff_ref) : null) ??
                      l.staff_ref ??
                      "nobody"}
                  </Link>
                  <Text type="supporting" color="secondary">
                    Due {formatTime(l.due_at, tz)}
                  </Text>
                </VStack>
              ))}
          </VStack>
        </Card>
      ))}
      <IssueNow venueId={venueId} week={thisWeek} />
    </VStack>
  );
}
