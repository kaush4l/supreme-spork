import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchBill, fetchBills } from "@/server/data/bills";
import { centsToInput } from "@/server/data/money-input";
import { formatMoney } from "@/server/format";
import { isDay } from "../dates";
import { cadenceLabel, kindLabel } from "../words";
import { DocketLinks } from "./dockets";
import { EditBillForm } from "./edit-form";
import { MarkButtons } from "./mark-buttons";

export const metadata = { title: "Bill" };

export default async function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string; billId: string }>;
  searchParams: Promise<{ due?: string }>;
}) {
  const { venueId, billId } = await params;
  if (
    !z.uuid().safeParse(venueId).success ||
    !z.uuid().safeParse(billId).success
  )
    notFound();
  const { due } = await searchParams;
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/bills/${billId}`;
  const bill = await fetchBill(principal.accessToken, venueId, billId, here);
  // A replaced id answers with the newest version under its own id.
  if (bill.bill_id !== billId)
    redirect(
      `/venues/${venueId}/bills/${bill.bill_id}${isDay(due) ? `?due=${due}` : ""}`,
    );
  // The due date to show: the one in an older link, else the next one.
  let occurrence = bill.occurrences.find((o) => o.due_on === due);
  if (!occurrence && isDay(due)) {
    const list = await fetchBills(
      principal.accessToken,
      venueId,
      { from: due, to: due, status: "all", offset: 0 },
      here,
    );
    occurrence = list.items.find((o) => o.bill_id === billId);
  }
  occurrence ??= bill.occurrences[0];

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/bills`}>Back to bills</Link>
      <Heading level={1}>{bill.label}</Heading>
      <Card padding={4}>
        <VStack gap={1} hAlign="stretch">
          <Text type="body">
            {formatMoney(bill.amount_cents)}
            {occurrence ? ` due ${occurrence.due_on}` : ""}
          </Text>
          {occurrence ? (
            <Text type="supporting" color="secondary">
              {occurrence.state_label}. {occurrence.help}
            </Text>
          ) : null}
          <Text type="supporting" color="secondary">
            {kindLabel(bill.kind)}, {cadenceLabel(bill.cadence)}
            {bill.counterparty ? `, paid to ${bill.counterparty}` : ""}
          </Text>
          {occurrence?.note ? (
            <Text type="supporting" color="secondary">
              Note: {occurrence.note}
            </Text>
          ) : null}
        </VStack>
      </Card>

      {occurrence ? (
        <>
          <Heading level={2}>This due date</Heading>
          <MarkButtons
            venueId={venueId}
            billId={bill.bill_id}
            dueOn={occurrence.due_on}
            state={occurrence.state}
          />

          <Heading level={2}>Dockets</Heading>
          <DocketLinks
            venueId={venueId}
            billId={bill.bill_id}
            dueOn={occurrence.due_on}
            dockets={occurrence.dockets.map((d) => ({
              id: d.document_id,
              name: d.filename ?? d.document_id,
            }))}
          />
        </>
      ) : null}

      <Heading level={2}>Change this bill</Heading>
      <EditBillForm
        venueId={venueId}
        billId={bill.bill_id}
        label={bill.label}
        amount={centsToInput(bill.amount_cents)}
        cadence={bill.cadence}
        nextDue={bill.next_due ?? ""}
      />
    </VStack>
  );
}
