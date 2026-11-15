import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchMessages } from "@/server/data/insights";
import { formatDay, formatTime } from "@/server/format";

export const metadata = { title: "Monday messages" };

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/messages`;
  const [me, page] = await Promise.all([
    fetchMe(backend(token)),
    fetchMessages(token, venueId, offset, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const more = (to: number) => `${here}?offset=${to}`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Monday messages</Heading>
      <Text type="supporting" color="secondary">
        What Minder sent this venue, newest first.
      </Text>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No messages have been sent to this venue yet.
        </Text>
      ) : (
        page.items.map((m) => (
          <Card key={m.id} padding={4}>
            <VStack gap={1} hAlign="stretch">
              <Text type="body">
                <Link href={`${here}/${m.id}`}>{m.title ?? "Message"}</Link>
              </Text>
              <Text type="supporting" color="secondary">
                {m.sent_at
                  ? `${formatDay(m.sent_at, tz)} ${formatTime(m.sent_at, tz)}`
                  : "Not sent yet"}{" "}
                · {m.status}
                {m.finding_count > 0
                  ? ` · ${m.finding_count} finding${m.finding_count === 1 ? "" : "s"}`
                  : ""}
              </Text>
            </VStack>
          </Card>
        ))
      )}
      <HStack gap={4} wrap="wrap">
        {page.offset > 0 ? (
          <Link href={more(Math.max(0, page.offset - page.limit))}>
            Newer messages
          </Link>
        ) : null}
        {page.offset + page.items.length < page.total ? (
          <Link href={more(page.offset + page.limit)}>Older messages</Link>
        ) : null}
      </HStack>
    </VStack>
  );
}
