import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { requirePrincipal } from "@/server/auth/principal";
import { pushPublicKey } from "@/server/data/push";
import { AlertsCard } from "./alerts-card";

export const metadata = { title: "Alerts on this phone" };

export default async function AlertsPage() {
  const principal = await requirePrincipal();
  const publicKey = await pushPublicKey(principal.accessToken);
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>My alerts</Heading>
        <Text type="body" color="secondary">
          Get a short alert on this phone when a venue you work at posts
          something new. The alert says only which venue and how many updates;
          you see the details after you sign in.
        </Text>
      </VStack>
      <AlertsCard userId={principal.userId} publicKey={publicKey} />
      <Link href="/">Back</Link>
    </VStack>
  );
}
