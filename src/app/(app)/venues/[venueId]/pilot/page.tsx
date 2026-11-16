import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchScorecard } from "@/server/data/pilot";
import { isDay } from "../timesheet/range";
import { RangeForm } from "./range-form";
import { WeekTable } from "./week-table";
import {
  figureWords,
  passMarkWords,
  statusWords,
  weekColumns,
  weekRows,
} from "./words";

export const metadata = { title: "Pilot scorecard" };

export default async function PilotScorecardPage({
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
  // With no valid dates the backend chooses the period (from the first published roster to today).
  const range =
    isDay(query.from) && isDay(query.to)
      ? { from: query.from, to: query.to }
      : {};
  const here = `/venues/${venueId}/pilot`;
  const result = await fetchScorecard(
    principal.accessToken,
    venueId,
    range,
    here,
  );
  const period = result.ok ? result.scorecard.period : null;
  const csvQuery =
    range.from && range.to ? `?from=${range.from}&to=${range.to}` : "";

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Pilot scorecard</Heading>
      <RangeForm
        venueId={venueId}
        from={range.from ?? period?.from ?? ""}
        to={range.to ?? period?.to ?? ""}
      />
      {result.ok ? (
        <>
          <Text type="body">
            {period?.from
              ? `Period: ${period.from} to ${period.to} (${period.weeks} ${period.weeks === 1 ? "week" : "weeks"})`
              : "No roster has been published yet, so there is no period to show."}
          </Text>
          <Link href={`/venues/${venueId}/pilot/csv${csvQuery}`} download>
            Download CSV
          </Link>
          {result.scorecard.measures.map((m) => {
            const status = statusWords(m.status);
            const figure = figureWords(m);
            const passMark = passMarkWords(m);
            return (
              <Card key={m.key} padding={4}>
                <VStack gap={2} hAlign="stretch">
                  <Heading level={2}>{m.label}</Heading>
                  <Badge label={status.label} variant={status.variant} />
                  {figure ? <Text type="body">{figure}</Text> : null}
                  {passMark ? (
                    <Text type="supporting" color="secondary">
                      {passMark}
                    </Text>
                  ) : null}
                  <Text type="supporting" color="secondary">
                    {m.basis}
                  </Text>
                </VStack>
              </Card>
            );
          })}
          <Heading level={2}>Week by week</Heading>
          <Text type="supporting" color="secondary">
            Each cell shows how many out of how many, for the week starting on
            that Monday.
          </Text>
          {result.scorecard.weeks.length === 0 ? (
            <Text type="supporting" color="secondary">
              There are no weeks to show yet.
            </Text>
          ) : (
            <WeekTable
              rows={weekRows(result.scorecard.measures, result.scorecard.weeks)}
              columns={weekColumns(
                result.scorecard.measures,
                result.scorecard.weeks,
              )}
            />
          )}
        </>
      ) : (
        <Banner status="error" title={result.message} />
      )}
    </VStack>
  );
}
