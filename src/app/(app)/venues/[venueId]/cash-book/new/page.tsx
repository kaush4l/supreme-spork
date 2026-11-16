import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchBills } from "@/server/data/bills";
import { fetchPayable } from "@/server/data/cash-book";
import { myRights } from "@/server/data/me";
import { listSuppliers } from "@/server/data/suppliers";
import { formatMoney } from "@/server/format";
import { can } from "@/server/nav";
import { PaymentForm } from "./payment-form";

export const metadata = { title: "Add cash paid out" };

export default async function NewCashPaymentPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/cash-book/new`;
  const rights = await myRights(token, venueId, here);
  // Only a person who may record cash sees the form (the backend decides again on save).
  if (!can(rights, "cash.record")) notFound();
  const [people, suppliers, bills] = await Promise.all([
    fetchPayable(token, venueId, here),
    listSuppliers(token, venueId, here),
    can(rights, "money.cash")
      ? fetchBills(token, venueId, { status: "due", offset: 0 }, here)
      : Promise.resolve(null),
  ]);

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/cash-book`}>Back to the cash book</Link>
      <Heading level={1}>Add cash paid out</Heading>
      <Text type="supporting" color="secondary">
        Choose the kind first. A wages payment is sent to the person to confirm.
      </Text>
      <PaymentForm
        venueId={venueId}
        people={people.map((p) => ({ value: p.staffRef, label: p.name }))}
        suppliers={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        bills={(bills?.items ?? []).map((b) => ({
          value: `${b.bill_id}|${b.due_on}`,
          label: `${b.label}, ${formatMoney(b.amount_cents)}, due ${b.due_on}`,
        }))}
      />
    </VStack>
  );
}
