import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchPayments } from "@/server/data/cash-book";
import { myRights } from "@/server/data/me";
import { formatMoney } from "@/server/format";
import { can } from "@/server/nav";
import { FilterForm } from "./filter-form";
import { listHref, parseFilters, paymentTitle, periodText } from "./words";

export const metadata = { title: "Cash book" };

export default async function CashBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const filters = parseFilters(query);
  const offset = Math.max(
    0,
    Number.parseInt(
      typeof query.offset === "string" ? query.offset : "0",
      10,
    ) || 0,
  );
  const here = listHref(venueId, filters, offset);
  const [rights, list] = await Promise.all([
    myRights(token, venueId, here),
    fetchPayments(token, venueId, { ...filters, offset }, here),
  ]);
  const mayWrite = can(rights, "cash.record");
  const base = `/venues/${venueId}/cash-book`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Cash book</Heading>
      <Text type="supporting" color="secondary">
        Cash paid out to staff and suppliers, and petty cash. Wages wait for the
        person paid to confirm they got the cash.
      </Text>
      {mayWrite ? <Link href={`${base}/new`}>Add cash paid out</Link> : null}
      <Link href={`${base}/summary`}>Summary and spreadsheet</Link>
      <Link href={`${base}/till`}>Till counts</Link>
      <FilterForm venueId={venueId} filters={filters} />
      <Text type="body">
        {list.total} {list.total === 1 ? "payment" : "payments"}
        {filters.unconfirmed ? " waiting to be confirmed" : ""}
      </Text>
      {list.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {filters.kind ||
          filters.unconfirmed ||
          filters.from ||
          filters.to ||
          filters.person ||
          filters.supplier
            ? "No cash payments match these filters."
            : "No cash has been recorded as paid out yet."}
        </Text>
      ) : null}
      {list.items.map((p) => (
        <Card key={p.id} padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Heading level={3}>
              <Link href={`${base}/${p.id}`}>{paymentTitle(p)}</Link>
            </Heading>
            <Text type="body">
              {formatMoney(p.amount_cents)}, paid {p.paid_on}
            </Text>
            <Text type="supporting" color="secondary">
              {p.status_label}
              {periodText(p) ? `. ${periodText(p)}` : ""}
            </Text>
          </VStack>
        </Card>
      ))}
      {offset > 0 ? (
        <Link
          href={listHref(venueId, filters, Math.max(0, offset - list.limit))}
        >
          Earlier ones
        </Link>
      ) : null}
      {offset + list.items.length < list.total ? (
        <Link href={listHref(venueId, filters, offset + list.limit)}>More</Link>
      ) : null}
    </VStack>
  );
}
