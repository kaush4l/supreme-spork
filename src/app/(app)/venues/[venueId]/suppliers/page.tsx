import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { listSuppliers } from "@/server/data/suppliers";
import { isOwnerLike } from "@/server/nav";
import { SupplierForm } from "./supplier-form";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/suppliers`;
  const token = principal.accessToken;
  const [rights, suppliers] = await Promise.all([
    myRights(token, venueId, here),
    listSuppliers(token, venueId, here),
  ]);
  const canEdit = isOwnerLike(rights);
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Suppliers</Heading>
      <Link href={`${here}/compare`}>Compare prices between suppliers</Link>
      {suppliers.length === 0 ? (
        <Text type="supporting" color="secondary">
          No suppliers yet. They appear here as dockets come in.
        </Text>
      ) : (
        <Card padding={4}>
          <VStack gap={2}>
            {suppliers.map((s) => (
              <Link key={s.id} href={`${here}/${s.id}`}>
                {s.name}
                {s.provisional ? " (new, not yet confirmed)" : ""}
              </Link>
            ))}
          </VStack>
        </Card>
      )}
      {canEdit ? (
        <Card padding={4}>
          <VStack gap={3} hAlign="stretch">
            <Heading level={2}>Add a supplier</Heading>
            <SupplierForm venueId={venueId} />
          </VStack>
        </Card>
      ) : null}
    </VStack>
  );
}
