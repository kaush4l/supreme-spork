import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchTillCounts } from "@/server/data/cash-book";
import { myRights } from "@/server/data/me";
import { formatMoney } from "@/server/format";
import { can } from "@/server/nav";
import { TillForm } from "./till-form";

export const metadata = { title: "Till counts" };

export default async function TillPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const base = `/venues/${venueId}/cash-book/till`;
  const here = offset > 0 ? `${base}?offset=${offset}` : base;
  const [rights, counts] = await Promise.all([
    myRights(token, venueId, here),
    fetchTillCounts(token, venueId, offset, here),
  ]);

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/cash-book`}>Back to the cash book</Link>
      <Heading level={1}>Till counts</Heading>
      {can(rights, "cash.record") ? (
        <>
          <Heading level={2}>Count the till</Heading>
          <TillForm venueId={venueId} />
        </>
      ) : null}
      <Heading level={2}>Earlier counts</Heading>
      {counts.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          The till has not been counted yet.
        </Text>
      ) : null}
      {counts.items.map((c) => (
        <Card key={c.id} padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Heading level={3}>
              {c.trading_day}
              {c.recounted ? " (counted again)" : ""}
            </Heading>
            <Text type="body">
              Counted {formatMoney(c.counted_cents)}, float{" "}
              {formatMoney(c.float_cents)}, cash paid out that day{" "}
              {formatMoney(c.cash_paid_out_cents)}
            </Text>
            {c.expected_cents != null ? (
              <Text type="body">
                Expected {formatMoney(c.expected_cents)}
                {c.gap_cents != null
                  ? `, difference ${formatMoney(c.gap_cents)}`
                  : ""}
              </Text>
            ) : null}
            <Text type="supporting" color="secondary">
              {c.flag_label}
            </Text>
            {c.note ? (
              <Text type="supporting" color="secondary">
                Note: {c.note}
              </Text>
            ) : null}
          </VStack>
        </Card>
      ))}
      {offset > 0 ? (
        <Link href={`${base}?offset=${Math.max(0, offset - counts.limit)}`}>
          Earlier ones
        </Link>
      ) : null}
      {offset + counts.items.length < counts.total ? (
        <Link href={`${base}?offset=${offset + counts.limit}`}>More</Link>
      ) : null}
    </VStack>
  );
}
