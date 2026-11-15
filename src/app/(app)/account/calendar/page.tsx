import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { requirePrincipal } from "@/server/auth/principal";
import { myCalendar } from "@/server/data/person";
import { dayLabel } from "@/server/data/person-text";
import { CalendarLink } from "./calendar-link";

export const metadata = { title: "My calendar link" };

export default async function CalendarPage() {
  const principal = await requirePrincipal();
  const status = await myCalendar(principal.accessToken);
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>My calendar link</Heading>
        <Text type="body" color="secondary">
          A private link for Google or Apple Calendar. It shows your published
          shifts at every venue and nothing else.
        </Text>
      </VStack>
      <CalendarLink
        hasLink={status.has_link}
        sinceLabel={status.since ? dayLabel(status.since) : null}
      />
      <Link href="/">Back</Link>
    </VStack>
  );
}
