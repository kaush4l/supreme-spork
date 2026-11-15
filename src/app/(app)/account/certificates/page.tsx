import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { requirePrincipal } from "@/server/auth/principal";
import { myCertificates } from "@/server/data/person";
import { dayLabel, kindLabel, sourceLabel } from "@/server/data/person-text";
import { Certificates } from "./certificates";

export const metadata = { title: "My certificates" };

export default async function CertificatesPage() {
  const principal = await requirePrincipal();
  const rows = await myCertificates(principal.accessToken);
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>My certificates</Heading>
        <Text type="body" color="secondary">
          Your own record, kept for every venue you work at. You can type the
          details here; photos of certificates are not stored yet.
        </Text>
      </VStack>
      <Certificates
        rows={rows.map((r) => ({
          kind: r.kind,
          kindLabel: kindLabel(r.kind),
          number: r.number,
          expiresOn: r.expires_on,
          expiresLabel: dayLabel(r.expires_on),
          sourceLabel: sourceLabel(r.source),
        }))}
      />
      <Link href="/">Back</Link>
    </VStack>
  );
}
