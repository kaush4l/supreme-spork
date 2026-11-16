import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchPayment } from "@/server/data/cash-book";
import { myRights } from "@/server/data/me";
import { formatDay, formatMoney, formatTime } from "@/server/format";
import { can } from "@/server/nav";
import { kindLabel, paymentTitle, periodText } from "../words";
import { CancelForm } from "./cancel-form";

export const metadata = { title: "Cash payment" };

export default async function CashPaymentPage({
  params,
}: {
  params: Promise<{ venueId: string; paymentId: string }>;
}) {
  const { venueId, paymentId } = await params;
  if (
    !z.uuid().safeParse(venueId).success ||
    !z.uuid().safeParse(paymentId).success
  )
    notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/cash-book/${paymentId}`;
  const [rights, payment, me] = await Promise.all([
    myRights(token, venueId, here),
    fetchPayment(token, venueId, paymentId, here),
    fetchMe(backend(token)),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const base = `/venues/${venueId}/cash-book`;
  const when = (iso: string) =>
    `${formatDay(iso, tz)} at ${formatTime(iso, tz)}`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={base}>Back to the cash book</Link>
      <Heading level={1}>{paymentTitle(payment)}</Heading>
      <Card padding={4}>
        <VStack gap={1} hAlign="stretch">
          <Text type="body">
            {formatMoney(payment.amount_cents)}, {kindLabel(payment.kind)}
          </Text>
          <Text type="body">Paid on {payment.paid_on}</Text>
          <Text type="body">Status: {payment.status_label}</Text>
          {periodText(payment) ? (
            <Text type="supporting" color="secondary">
              {periodText(payment)}
            </Text>
          ) : null}
          {payment.note ? (
            <Text type="supporting" color="secondary">
              Note: {payment.note}
            </Text>
          ) : null}
          <Text type="supporting" color="secondary">
            Recorded by {payment.recorded_by_name ?? "someone no longer listed"}
          </Text>
          {payment.confirmed_at ? (
            <Text type="supporting" color="secondary">
              Confirmed by {payment.payee?.name ?? "the person paid"},{" "}
              {when(payment.confirmed_at)}
            </Text>
          ) : null}
          {payment.kind === "wages" &&
          !payment.confirmed_at &&
          !payment.cancelled &&
          payment.payee &&
          !payment.payee.can_confirm ? (
            <Text type="supporting" color="secondary">
              {payment.payee.name} has no login, so they cannot confirm this
              themselves.
            </Text>
          ) : null}
          {payment.cancelled ? (
            <Text type="body">
              Cancelled: {payment.cancel_reason ?? "no reason given"}
            </Text>
          ) : null}
          {payment.bill_id && can(rights, "money.cash") ? (
            <Link
              href={`/venues/${venueId}/bills/${payment.bill_id}${
                payment.bill_due_on ? `?due=${payment.bill_due_on}` : ""
              }`}
            >
              See the bill this paid
            </Link>
          ) : null}
        </VStack>
      </Card>
      {can(rights, "cash.record") ? (
        <>
          <Heading level={2}>
            {payment.cancelled ? "Cancelled" : "Cancel this payment"}
          </Heading>
          <CancelForm
            venueId={venueId}
            paymentId={paymentId}
            canCancel={!payment.cancelled}
          />
        </>
      ) : null}
    </VStack>
  );
}
