import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchPnl, type PnlBucket } from "@/server/data/pnl";
import { formatMoney } from "@/server/format";
import { choosePeriod, choosePnlRange } from "./range";
import { RangeForm } from "./range-form";
import {
  basisWord,
  groupWord,
  SECTION_ORDER,
  sectionWord,
  statusWord,
} from "./words";

export const metadata = { title: "Profit and loss" };

const amount = (cents: number | null) =>
  cents == null ? "No figure" : formatMoney(cents);

function BucketCard({
  venueId,
  bucket,
}: {
  venueId: string;
  bucket: PnlBucket;
}) {
  const sections = SECTION_ORDER.filter((s) =>
    bucket.lines.some((l) => l.section === s),
  );
  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={3}>
          {bucket.start === bucket.end
            ? bucket.start
            : `${bucket.start} to ${bucket.end}`}
        </Heading>
        {bucket.cut ? (
          <Text type="supporting" color="secondary">
            This period is cut short by the dates you chose.
          </Text>
        ) : null}
        {sections.map((s) => (
          <VStack key={s} gap={2} hAlign="stretch">
            <Heading level={4}>{sectionWord(s)}</Heading>
            {bucket.lines
              .filter((l) => l.section === s)
              .map((l) => (
                <VStack key={l.key} gap={1} hAlign="stretch">
                  <Text type="body">
                    {l.label}: {amount(l.amount_cents)} ({statusWord(l.status)})
                  </Text>
                  <Text type="supporting" color="secondary">
                    {basisWord(l.basis)}: {l.date_used}
                  </Text>
                  {l.note ? (
                    <Text type="supporting" color="secondary">
                      {l.note}
                    </Text>
                  ) : null}
                  {Object.entries(l.sources).map(([group, count]) => (
                    <Link
                      key={group}
                      href={`/venues/${venueId}/pnl/sources?line=${encodeURIComponent(l.key)}&from=${bucket.start}&to=${bucket.end}&group=${group}`}
                    >
                      See the {count} {groupWord(group)} behind {l.label}
                    </Link>
                  ))}
                </VStack>
              ))}
          </VStack>
        ))}
        <VStack gap={2} hAlign="stretch">
          <Heading level={4}>Result</Heading>
          {Object.values(bucket.totals).map((t) => (
            <VStack key={t.key} gap={1} hAlign="stretch">
              <Text type="body">
                {t.label}: {amount(t.amount_cents)} ({statusWord(t.status)})
              </Text>
              {t.note ? (
                <Text type="supporting" color="secondary">
                  {t.note}
                </Text>
              ) : null}
            </VStack>
          ))}
        </VStack>
        {bucket.completeness.length > 0 ? (
          <Banner
            status="warning"
            title="What is missing or not complete"
            description={bucket.completeness.join(" ")}
          />
        ) : null}
      </VStack>
    </Card>
  );
}

export default async function PnlPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const chosen = choosePnlRange(query.from, query.to);
  const period = choosePeriod(query.period);
  const here = chosen
    ? `/venues/${venueId}/pnl?period=${period}&from=${chosen.from}&to=${chosen.to}`
    : `/venues/${venueId}/pnl?period=${period}`;
  const result = await fetchPnl(token, venueId, period, chosen, here);
  const from = result.ok ? result.report.from : (chosen?.from ?? "");
  const to = result.ok ? result.report.to : (chosen?.to ?? "");

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Profit and loss</Heading>
      <RangeForm venueId={venueId} period={period} from={from} to={to} />
      {result.ok ? (
        <>
          <Link
            href={`/venues/${venueId}/pnl/csv?period=${period}&from=${from}&to=${to}`}
            download
          >
            Download as a spreadsheet (CSV)
          </Link>
          <Card padding={4}>
            <VStack gap={1} hAlign="stretch">
              <Heading level={3}>How these figures are worked out</Heading>
              {Object.entries(result.report.basis).map(([k, text]) => (
                <Text key={k} type="supporting" color="secondary">
                  {text}
                </Text>
              ))}
            </VStack>
          </Card>
          {result.report.buckets.length === 0 ? (
            <Text type="supporting" color="secondary">
              There is nothing to show between {from} and {to}.
            </Text>
          ) : null}
          {result.report.buckets.map((b) => (
            <BucketCard key={b.start} venueId={venueId} bucket={b} />
          ))}
        </>
      ) : (
        <Banner status="error" title={result.message} />
      )}
    </VStack>
  );
}
