import { Banner } from "@astryxdesign/core/Banner";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchSummary } from "@/server/data/cash-book";
import { formatMoney } from "@/server/format";
import { chooseRange, todayIn } from "../../timesheet/range";
import { PeopleTable } from "./people-table";
import { RangeForm } from "./range-form";
import { summaryRow } from "./rows";

export const metadata = { title: "Cash book summary" };

export default async function CashSummaryPage({
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
  const here = `/venues/${venueId}/cash-book/summary?from=${from}&to=${to}`;
  const result = await fetchSummary(token, venueId, from, to, here);

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/cash-book`}>Back to the cash book</Link>
      <Heading level={1}>Cash book summary</Heading>
      <RangeForm venueId={venueId} from={from} to={to} />
      {result.ok ? (
        <>
          <Link
            href={`/venues/${venueId}/cash-book/summary/csv?from=${from}&to=${to}`}
            download
          >
            Download cash wages as a spreadsheet (CSV)
          </Link>
          <Heading level={2}>
            Paid out, {result.summary.from} to {result.summary.to}
          </Heading>
          <Text type="body">
            Total: {formatMoney(result.summary.paid_out.total_cents)}
          </Text>
          <Text type="body">
            Wages: {formatMoney(result.summary.paid_out.wages)}
          </Text>
          <Text type="body">
            Suppliers: {formatMoney(result.summary.paid_out.supplier)}
          </Text>
          <Text type="body">
            Petty cash: {formatMoney(result.summary.paid_out.petty)}
          </Text>
          <Text type="body">
            Wages not yet confirmed: {result.summary.unconfirmed.count} (
            {formatMoney(result.summary.unconfirmed.total_cents)})
          </Text>
          <Heading level={2}>Hours against cash paid</Heading>
          <Text type="supporting" color="secondary">
            The last column is cash paid minus the cost of the hours worked.
            Cash can be only part of someone&apos;s pay (the rest may go by
            bank), so a difference is a reason to look, not a verdict.
          </Text>
          {result.summary.people.length === 0 ? (
            <Text type="supporting" color="secondary">
              Nobody worked or was paid cash between {from} and {to}.
            </Text>
          ) : (
            <PeopleTable rows={result.summary.people.map(summaryRow)} />
          )}
        </>
      ) : (
        <Banner status="error" title={result.message} />
      )}
    </VStack>
  );
}
