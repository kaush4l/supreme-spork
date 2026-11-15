import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { requirePrincipal } from "@/server/auth/principal";
import { myAvailability } from "@/server/data/person";
import { whenLabel } from "@/server/data/person-text";
import { Availability } from "./availability";

export const metadata = { title: "My availability" };

export default async function AvailabilityPage() {
  const principal = await requirePrincipal();
  const rows = await myAvailability(principal.accessToken);
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>My availability</Heading>
        <Text type="body" color="secondary">
          When you can and cannot work. Every venue you work at sees this.
        </Text>
      </VStack>
      <Availability
        rows={rows.map((r) => ({
          id: r.id,
          when: whenLabel(r),
          available: r.available,
          note: r.note,
        }))}
      />
      <Link href="/">Back</Link>
    </VStack>
  );
}
