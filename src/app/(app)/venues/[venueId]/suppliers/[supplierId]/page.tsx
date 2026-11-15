import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { supplierPrices } from "@/server/data/suppliers";
import { formatMoney } from "@/server/format";
import { isOwnerLike } from "@/server/nav";
import { SupplierForm } from "../supplier-form";

export const metadata = { title: "Supplier" };

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ venueId: string; supplierId: string }>;
}) {
  const { venueId, supplierId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(supplierId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/suppliers/${supplierId}`;
  const token = principal.accessToken;
  const [rights, history] = await Promise.all([
    myRights(token, venueId, here),
    supplierPrices(token, venueId, supplierId, here),
  ]);
  const s = history.supplier;
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/suppliers`}>All suppliers</Link>
      <Heading level={1}>{s.name}</Heading>
      <Text type="supporting" color="secondary">
        {s.category ? `${s.category}. ` : ""}
        {s.payment_terms_days !== null
          ? `Pay ${s.payment_terms_days} days after delivery. `
          : ""}
        {s.aliases.length > 0
          ? `Also written as: ${s.aliases.join(", ")}.`
          : ""}
        {s.provisional
          ? " A docket created this supplier; please check it."
          : ""}
      </Text>
      {isOwnerLike(rights) ? (
        <Card padding={4}>
          <VStack gap={3} hAlign="stretch">
            <Heading level={2}>Edit this supplier</Heading>
            <SupplierForm
              key={s.id}
              venueId={venueId}
              initial={{
                id: s.id,
                name: s.name,
                aliases: s.aliases,
                category: s.category,
                paymentTermsDays: s.payment_terms_days,
                provisional: s.provisional,
              }}
            />
          </VStack>
        </Card>
      ) : null}
      <Heading level={2}>Prices paid</Heading>
      {history.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No purchases from this supplier yet.
        </Text>
      ) : (
        history.items.map((item) => (
          <Card key={item.item_id} padding={4}>
            <VStack gap={2}>
              <Heading level={3}>{item.item ?? "Unnamed item"}</Heading>
              {item.points.map((p) => (
                <Text key={p.purchase_id} type="body">
                  {p.date}: {p.qty} {p.unit ?? ""}
                  {p.unit_price_cents !== null
                    ? ` at ${formatMoney(p.unit_price_cents)}`
                    : ""}
                  {p.total_cents !== null
                    ? `, total ${formatMoney(p.total_cents)}`
                    : ""}
                </Text>
              ))}
            </VStack>
          </Card>
        ))
      )}
    </VStack>
  );
}
