import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { deliveryDay, docketDetail } from "@/server/data/dockets";
import { myRights } from "@/server/data/me";
import { formatMoney } from "@/server/format";
import { readsBooks } from "@/server/nav";
import { canDecide, statusTone } from "../words";
import { ChangeForm } from "./change-form";
import { DecisionBar } from "./decision-bar";
import { KeyForm } from "./key-form";
import { DocketPhoto } from "./photo";

export const metadata = { title: "Docket" };

export default async function DocketPage({
  params,
}: {
  params: Promise<{ venueId: string; documentId: string }>;
}) {
  const { venueId, documentId } = await params;
  if (
    !z.uuid().safeParse(venueId).success ||
    !z.uuid().safeParse(documentId).success
  )
    notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/dockets/${documentId}`;
  const token = principal.accessToken;
  const rights = await myRights(token, venueId, here);
  if (!readsBooks(rights)) notFound();
  const d = await docketDetail(token, venueId, documentId, here);
  const decide = canDecide(rights);
  const money = (c: number | null) =>
    c === null ? "not read" : formatMoney(c);
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/dockets`}>Back to dockets</Link>
      <Heading level={1}>
        {d.supplier ?? "Supplier not read"} · {deliveryDay(d.delivery_date)}
      </Heading>
      <Badge label={d.label} variant={statusTone(d.status)} />
      <Text type="supporting" color="secondary">
        {d.help}
      </Text>
      {d.reasons.map((r) => (
        <Text key={r} type="body">
          {r}
        </Text>
      ))}
      <DocketPhoto
        url={d.image_url}
        expiresIn={d.image_expires_in_seconds}
        isPdf={d.mime_type === "application/pdf"}
      />
      <Card padding={4}>
        <VStack gap={1} hAlign="start">
          <Text type="body">Invoice number: {d.invoice_no ?? "not read"}</Text>
          <Text type="body">Docket total: {money(d.total_cents)}</Text>
          <Text type="body">GST: {money(d.gst_cents)}</Text>
          <Text type="body">Lines add up to: {money(d.lines_sum_cents)}</Text>
        </VStack>
      </Card>
      <Heading level={2}>Lines</Heading>
      {d.lines.length === 0 ? (
        <Text type="supporting" color="secondary">
          No lines yet.
        </Text>
      ) : (
        d.lines.map((l) => (
          <Card key={l.line} padding={4}>
            <VStack gap={1} hAlign="start">
              <Text type="label">
                {l.line}. {l.description ?? "No description"}
              </Text>
              <Text type="body">
                {l.qty === null ? "Quantity not read" : `Quantity ${l.qty}`}
                {l.unit_text ? ` ${l.unit_text}` : ""} · each{" "}
                {money(l.unit_price_cents)} · line total {money(l.total_cents)}
              </Text>
              {l.flags.map((f) => (
                <Text key={f} type="supporting" color="secondary">
                  {f}
                </Text>
              ))}
            </VStack>
          </Card>
        ))
      )}
      {decide && d.status === "needs_check" ? (
        <DecisionBar venueId={venueId} documentId={documentId} />
      ) : null}
      {decide && (d.status === "needs_check" || d.status === "booked") ? (
        <ChangeForm
          key={`${d.lines.length}-${d.total_cents}-${d.supplier}-${d.delivery_date}-${d.invoice_no}`}
          venueId={venueId}
          documentId={documentId}
          original={d}
        />
      ) : null}
      {decide && d.status === "needs_keying" ? (
        <KeyForm venueId={venueId} documentId={documentId} />
      ) : null}
    </VStack>
  );
}
