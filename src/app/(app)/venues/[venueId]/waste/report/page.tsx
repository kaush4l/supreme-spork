import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchWasteReport } from "@/server/data/waste";
import { formatMoney } from "@/server/format";
import { isDay } from "../../timesheet/range";
import { RangeForm } from "./range-form";

export const metadata = { title: "Waste report" };

export default async function WasteReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  // No dates: the API chooses its own default range and says which in the answer.
  const range =
    isDay(query.from) && isDay(query.to) && query.from <= query.to
      ? { from: query.from, to: query.to }
      : null;
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/waste/report${range ? `?from=${range.from}&to=${range.to}` : ""}`;
  const report = await fetchWasteReport(
    principal.accessToken,
    venueId,
    range,
    here,
  );

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/waste`}>Back to waste</Link>
      <Heading level={1}>Waste report</Heading>
      <RangeForm venueId={venueId} from={report.from} to={report.to} />
      <Text type="body">
        {report.from} to {report.to}: {report.totals.entries}{" "}
        {report.totals.entries === 1 ? "entry" : "entries"}, cost{" "}
        {formatMoney(report.totals.cost_cents)}
      </Text>
      {report.totals.uncosted_entries > 0 ? (
        <Banner
          status="warning"
          title={`${report.totals.uncosted_entries} ${report.totals.uncosted_entries === 1 ? "entry has" : "entries have"} no cost yet`}
          description="These are not counted in the cost above."
        />
      ) : null}
      {report.weeks.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nothing was thrown away between {report.from} and {report.to}.
        </Text>
      ) : null}
      {report.weeks.map((w) => (
        <Card key={w.week_start} padding={4}>
          <VStack gap={3} hAlign="stretch">
            <Heading level={3}>
              Week of {w.week_start} to {w.week_end}
            </Heading>
            <Text type="body">
              {w.entries} {w.entries === 1 ? "entry" : "entries"},{" "}
              {formatMoney(w.cost_cents)}
            </Text>
            {w.items.map((i) => (
              <VStack key={i.item_id} gap={1} hAlign="stretch">
                <Text type="body">
                  {i.item}: {formatMoney(i.cost_cents)}
                </Text>
                {i.reasons.map((r) => (
                  <Text key={r.reason} type="supporting" color="secondary">
                    {r.reason_label}: {r.qty_text}, {r.entries}{" "}
                    {r.entries === 1 ? "entry" : "entries"},{" "}
                    {formatMoney(r.cost_cents)}
                    {r.uncosted_entries > 0
                      ? ` (${r.uncosted_entries} with no cost yet)`
                      : ""}
                  </Text>
                ))}
              </VStack>
            ))}
          </VStack>
        </Card>
      ))}
      {report.uncosted.length > 0 ? (
        <Card padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={3}>No cost yet</Heading>
            {report.uncosted.map((u) => (
              <VStack key={u.entry_id} gap={1} hAlign="stretch">
                <Link href={`/venues/${venueId}/waste/${u.entry_id}`}>
                  {u.item}: {u.qty_text}, {u.reason_label} ({u.occurred_on})
                </Link>
                <Text type="supporting" color="secondary">
                  {u.why}
                </Text>
              </VStack>
            ))}
          </VStack>
        </Card>
      ) : null}
      <Text type="supporting" color="secondary">
        {report.basis}
      </Text>
    </VStack>
  );
}
