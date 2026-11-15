import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import {
  type DuplicatePair,
  deliveryDay,
  docketDuplicates,
  docketQueue,
} from "@/server/data/dockets";
import { myRights } from "@/server/data/me";
import { formatMoney } from "@/server/format";
import { readsBooks } from "@/server/nav";
import { canSend, statusTone } from "./words";

export const metadata = { title: "Dockets" };

function copyLine(c: DuplicatePair["later"]): string {
  const parts = [
    c.supplier ?? "Supplier not read",
    deliveryDay(c.delivery_date),
    c.invoice_no ? `number ${c.invoice_no}` : null,
    c.total_cents === null ? null : formatMoney(c.total_cents),
  ];
  return parts.filter(Boolean).join(", ");
}

export default async function DocketsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/dockets`;
  const token = principal.accessToken;
  const rights = await myRights(token, venueId, here);
  if (!readsBooks(rights)) notFound();
  const [queue, copies] = await Promise.all([
    docketQueue(token, venueId, here),
    docketDuplicates(token, venueId, here),
  ]);
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Dockets</Heading>
      <Text type="supporting" color="secondary">
        Delivery dockets that need a person to check them or type them in.
      </Text>
      {canSend(rights) ? (
        <VStack gap={0} hAlign="start">
          <Button
            label="Send a docket"
            variant="primary"
            href={`/venues/${venueId}/dockets/send`}
          />
        </VStack>
      ) : null}
      <Heading level={2}>Waiting for a person</Heading>
      {queue.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No dockets are waiting.
        </Text>
      ) : (
        queue.items.map((d) => (
          <Card key={d.document_id} padding={4}>
            <VStack gap={2} hAlign="start">
              <Link href={`/venues/${venueId}/dockets/${d.document_id}`}>
                {d.supplier ?? "Supplier not read"} ·{" "}
                {deliveryDay(d.delivery_date)}
              </Link>
              <Badge label={d.label} variant={statusTone(d.status)} />
              <Text type="supporting" color="secondary">
                {d.help}
              </Text>
              {d.total_cents === null ? null : (
                <Text type="body">Total {formatMoney(d.total_cents)}</Text>
              )}
              {d.reasons.map((r) => (
                <Text key={r} type="body">
                  {r}
                </Text>
              ))}
            </VStack>
          </Card>
        ))
      )}
      <Heading level={2}>Possible copies</Heading>
      {copies.length === 0 ? (
        <Text type="supporting" color="secondary">
          No dockets look like copies of one you already have.
        </Text>
      ) : (
        copies.map((p) => (
          <Card key={p.later.document_id} padding={4}>
            <VStack gap={2} hAlign="start">
              <Text type="body">
                This docket looks like a copy ({p.rule_label}).
              </Text>
              <Link href={`/venues/${venueId}/dockets/${p.later.document_id}`}>
                {copyLine(p.later)}
              </Link>
              <Text type="supporting" color="secondary">
                {p.later.status === "waiting"
                  ? "Waiting for a person to decide."
                  : "Already booked."}
              </Text>
              <Text type="supporting" color="secondary">
                It looks like this earlier one:
              </Text>
              <Link
                href={`/venues/${venueId}/dockets/${p.earlier.document_id}`}
              >
                {copyLine(p.earlier)}
              </Link>
            </VStack>
          </Card>
        ))
      )}
    </VStack>
  );
}
