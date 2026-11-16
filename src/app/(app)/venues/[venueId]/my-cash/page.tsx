import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { CASH_PAGE_SIZE, myCashPayments } from "@/server/data/my-cash";
import { formatDay, formatMoney, formatTime } from "@/server/format";
import { ConfirmButton } from "./confirm-button";
import { paymentFor, statusFor } from "./words";

export const metadata = { title: "My cash" };

export default async function MyCashPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const { offset: rawOffset } = await searchParams;
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .catch(0)
    .parse(rawOffset ?? 0);
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/my-cash`;
  const token = principal.accessToken;
  const [me, page] = await Promise.all([
    fetchMe(backend(token)),
    myCashPayments(token, venueId, offset, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const hasMore = offset + page.items.length < page.total;
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>My cash</Heading>
      <Text type="supporting" color="secondary">
        Cash your venue has recorded as paid to you. Confirm each one once you
        have the money in your hand.
      </Text>
      {page.unconfirmed_count > 0 ? (
        <Text type="body">
          {page.unconfirmed_count === 1
            ? "1 payment is waiting for you to confirm."
            : `${page.unconfirmed_count} payments are waiting for you to confirm.`}
        </Text>
      ) : null}
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {offset > 0
            ? "No more payments."
            : "No cash payments have been recorded for you."}
        </Text>
      ) : (
        page.items.map((p) => (
          <Card
            key={p.id}
            padding={4}
            variant={p.status === "cancelled" ? "muted" : "default"}
          >
            <VStack gap={2} hAlign="stretch">
              <Text type="body">
                {formatMoney(p.amount_cents)} on {formatDay(p.paid_on, "UTC")}
              </Text>
              <Text type="supporting" color="secondary">
                {paymentFor(p)}
              </Text>
              <Text type="label">{statusFor(p.status, p.status_label)}</Text>
              {p.status === "confirmed" && p.confirmed_at ? (
                <Text type="supporting" color="secondary">
                  You confirmed it on {formatDay(p.confirmed_at, tz)}{" "}
                  {formatTime(p.confirmed_at, tz)}.
                </Text>
              ) : null}
              {p.status === "cancelled" && p.cancel_reason ? (
                <Text type="supporting" color="secondary">
                  {p.cancel_reason}
                </Text>
              ) : null}
              {p.status === "unconfirmed" ? (
                <ConfirmButton venueId={venueId} paymentId={p.id} />
              ) : null}
            </VStack>
          </Card>
        ))
      )}
      <HStack gap={4}>
        {offset > 0 ? (
          <Link href={`${here}?offset=${Math.max(0, offset - CASH_PAGE_SIZE)}`}>
            Newer
          </Link>
        ) : null}
        {hasMore ? (
          <Link href={`${here}?offset=${offset + CASH_PAGE_SIZE}`}>Older</Link>
        ) : null}
      </HStack>
    </VStack>
  );
}
