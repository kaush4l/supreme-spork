import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { ApiFailure } from "@/server/api/errors";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchFindings, fetchFindingWeeks } from "@/server/data/insights";
import { myRights } from "@/server/data/me";
import {
  fetchHistory,
  fetchSummary,
  type Summary,
} from "@/server/data/summary";
import { formatMoney } from "@/server/format";
import { can, isOwnerLike, mayOpen } from "@/server/nav";
import { DatePicker, WeekPicker } from "./pickers";
import { RefreshButton } from "./refresh-button";
import { SummaryCard } from "./summary-card";
import { targetPage } from "./targets";
import { chooseDay, chooseWeek, neighbourWeeks } from "./weeks";
import { targetWords } from "./words";

export const metadata = { title: "This week" };

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ day?: string; week?: string; offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const day = chooseDay(query.day);
  const addressWeek = chooseDay(query.week);
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/week`;
  const [me, rights] = await Promise.all([
    fetchMe(backend(token)),
    myRights(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const mayPnl = can(rights, "money.pnl.view");

  let summary: Summary | null = null;
  let summaryProblem: string | null = null;
  if (mayPnl) {
    try {
      summary = await fetchSummary(token, venueId, day, here);
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 422)
        summaryProblem = e.message;
      else throw e;
    }
  }
  const [history, weekList] = await Promise.all([
    mayPnl ? fetchHistory(token, venueId, here) : Promise.resolve(null),
    fetchFindingWeeks(token, venueId, here),
  ]);
  const week = chooseWeek(addressWeek, weekList.current_week, weekList.weeks);
  const found = await fetchFindings(token, venueId, week, offset, here);
  const shown = week;
  const near = shown
    ? neighbourWeeks(weekList.weeks, shown)
    : { previous: undefined, next: undefined };
  // Each attention item links to its page only when the person's navigation has that page.
  const links: Record<string, string> = {};
  for (const a of summary?.attention ?? []) {
    const page = targetPage(a.target?.kind);
    if (page && mayOpen(rights, page.nav))
      links[a.key] = `/venues/${venueId}${page.path}`;
  }
  const weekLink = (w: string) =>
    `/venues/${venueId}/week?week=${w}${day ? `&day=${day}` : ""}`;

  const pageLink = (to: number) => {
    const q = new URLSearchParams();
    if (week) q.set("week", week);
    if (day) q.set("day", day);
    q.set("offset", String(to));
    return `/venues/${venueId}/week?${q.toString()}`;
  };

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>This week</Heading>

      {mayPnl ? (
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>The day in figures</Heading>
          <DatePicker
            venueId={venueId}
            param="day"
            label="Day"
            value={summary?.day ?? day}
            keep={{ param: "week", value: addressWeek }}
          />
          {summaryProblem ? (
            <Banner status="error" title={summaryProblem} />
          ) : null}
          {summary ? (
            <>
              <SummaryCard
                summary={summary}
                venueId={venueId}
                tz={tz}
                links={links}
              />
              {isOwnerLike(rights) ? (
                <RefreshButton venueId={venueId} day={summary.day} />
              ) : null}
            </>
          ) : null}
          {history ? (
            <Card padding={4}>
              <VStack gap={2} hAlign="stretch">
                <Heading level={3}>Earlier days</Heading>
                {history.items.length === 0 ? (
                  <Text type="supporting" color="secondary">
                    No days have been saved yet.
                  </Text>
                ) : (
                  history.items.map((h) => (
                    <Text key={h.day} type="body">
                      <Link
                        href={`/venues/${venueId}/week?day=${h.day}${addressWeek ? `&week=${addressWeek}` : ""}`}
                      >
                        {h.day}
                      </Link>
                      : sales{" "}
                      {h.net_sales_cents === null
                        ? "not available"
                        : formatMoney(h.net_sales_cents)}
                      , labour{" "}
                      {h.labour_cents === null
                        ? "not available"
                        : formatMoney(h.labour_cents)}
                      {h.labour_pct ? ` (${h.labour_pct}%)` : ""}, prime cost{" "}
                      {h.prime_pct ? `${h.prime_pct}%` : "not known"} (
                      {targetWords(h.prime_vs_target)}), {h.attention_count} to
                      look at.
                    </Text>
                  ))
                )}
              </VStack>
            </Card>
          ) : null}
        </VStack>
      ) : null}

      <Heading level={2}>Findings</Heading>
      <WeekPicker
        venueId={venueId}
        weeks={weekList.weeks}
        value={shown}
        day={day}
      />
      <HStack gap={4} wrap="wrap">
        {near.previous ? (
          <Link href={weekLink(near.previous)}>Previous week</Link>
        ) : null}
        {near.next ? <Link href={weekLink(near.next)}>Next week</Link> : null}
      </HStack>
      {found.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {week
            ? `No findings for the week starting ${week}.`
            : "No findings yet. They appear here once the weekly check has run."}
        </Text>
      ) : (
        <VStack gap={2} hAlign="stretch">
          {found.items.map((f) => (
            <Card key={f.id} padding={4}>
              <VStack gap={1} hAlign="stretch">
                <Text type="body">
                  <Link href={`/venues/${venueId}/findings/${f.id}`}>
                    {f.label}
                  </Link>
                  {f.value_cents === null
                    ? ""
                    : `: ${formatMoney(f.value_cents)}`}
                </Text>
                <Text type="supporting" color="secondary">
                  {f.status_label} · week starting {f.week_start}
                </Text>
              </VStack>
            </Card>
          ))}
          <Text type="supporting" color="secondary">
            Showing {offset + 1} to {offset + found.items.length} of{" "}
            {found.total}.
          </Text>
          {offset + found.items.length < found.total ? (
            <Link href={pageLink(offset + found.limit)}>
              Show more findings
            </Link>
          ) : null}
        </VStack>
      )}
    </VStack>
  );
}
