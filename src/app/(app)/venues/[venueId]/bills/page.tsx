import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchBills, fetchOverdue } from "@/server/data/bills";
import { formatMoney } from "@/server/format";
import { AddBillForm } from "./add-form";
import { pickRange } from "./dates";
import { RangeForm } from "./range-form";
import { cadenceLabel, kindLabel } from "./words";

export const metadata = { title: "Bills" };

export default async function BillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    offset?: string;
  }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const range = pickRange(query.from, query.to);
  const status = query.status === "all" ? "all" : "due";
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const here = `/venues/${venueId}/bills`;
  const [bills, overdue] = await Promise.all([
    fetchBills(token, venueId, { ...range, status, offset }, here),
    fetchOverdue(token, venueId, here),
  ]);
  const base = `/venues/${venueId}/bills?from=${bills.from}&to=${bills.to}&status=${status}`;
  const hasOverdueNote =
    overdue.overdue.length > 0 ||
    overdue.terms_missing.length > 0 ||
    overdue.not_checked.length > 0;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Bills</Heading>
      <RangeForm
        venueId={venueId}
        from={bills.from}
        to={bills.to}
        status={status}
      />

      <Heading level={2}>Overdue</Heading>
      {!hasOverdueNote ? (
        <Text type="supporting" color="secondary">
          No supplier bills are overdue.
        </Text>
      ) : null}
      {overdue.overdue.length > 0 ? (
        <Text type="body">
          Overdue in total: {formatMoney(overdue.overdue_total_cents)}
        </Text>
      ) : null}
      {overdue.overdue.map((r) => (
        <Card key={r.document_id} padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Heading level={3}>{r.supplier}</Heading>
            <Text type="body">
              {formatMoney(r.total_cents)}, delivered {r.delivered_on}
              {r.invoice_no ? `, invoice ${r.invoice_no}` : ""}
            </Text>
            <Text type="supporting" color="secondary">
              Due {r.due_on}, {r.days_overdue} days overdue
            </Text>
          </VStack>
        </Card>
      ))}
      {overdue.not_checked.map((r) => (
        <Text key={r.document_id} type="supporting" color="secondary">
          {r.supplier}, {formatMoney(r.total_cents)} due {r.due_on}: {r.reason}
        </Text>
      ))}
      {overdue.terms_missing.map((m) => (
        <Text key={m.supplier} type="supporting" color="secondary">
          {m.supplier}: {m.dockets} docket{m.dockets === 1 ? "" : "s"},{" "}
          {formatMoney(m.total_cents)}, no payment terms held, so overdue cannot
          be checked.
        </Text>
      ))}

      <Heading level={2}>Due dates</Heading>
      <Text type="body">
        {bills.from} to {bills.to}: {formatMoney(bills.due_total_cents)} still
        to pay
      </Text>
      {bills.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No bills fall due in this time.
        </Text>
      ) : null}
      {bills.items.map((b) => (
        <Card key={`${b.bill_id}-${b.due_on}`} padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Heading level={3}>
              <Link
                href={`/venues/${venueId}/bills/${b.bill_id}?due=${b.due_on}`}
              >
                {b.label}
              </Link>
            </Heading>
            <Text type="body">
              {formatMoney(b.amount_cents)} due {b.due_on}
            </Text>
            <Text type="supporting" color="secondary">
              {b.state_label}. {b.help}
            </Text>
            <Text type="supporting" color="secondary">
              {kindLabel(b.kind)}, {cadenceLabel(b.cadence)}
              {b.dockets.length > 0
                ? `, ${b.dockets.length} docket${b.dockets.length === 1 ? "" : "s"} linked`
                : ""}
            </Text>
            {b.note ? (
              <Text type="supporting" color="secondary">
                Note: {b.note}
              </Text>
            ) : null}
          </VStack>
        </Card>
      ))}
      {offset > 0 ? (
        <Link href={`${base}&offset=${Math.max(0, offset - bills.limit)}`}>
          Earlier ones
        </Link>
      ) : null}
      {offset + bills.items.length < bills.total ? (
        <Link href={`${base}&offset=${offset + bills.limit}`}>More</Link>
      ) : null}

      <Heading level={2}>Add a bill</Heading>
      <AddBillForm venueId={venueId} />
    </VStack>
  );
}
