import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchMessage } from "@/server/data/insights";
import { formatDay, formatTime } from "@/server/format";

export const metadata = { title: "Monday message" };

export default async function MessagePage({
  params,
}: {
  params: Promise<{ venueId: string; messageId: string }>;
}) {
  const { venueId, messageId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(messageId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/messages/${messageId}`;
  const [me, message] = await Promise.all([
    fetchMe(backend(token)),
    fetchMessage(token, venueId, messageId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/messages`}>Back to messages</Link>
      <Heading level={1}>{message.title ?? "Message"}</Heading>
      <Text type="supporting" color="secondary">
        {message.sent_at
          ? `${formatDay(message.sent_at, tz)} ${formatTime(message.sent_at, tz)}`
          : "Not sent yet"}{" "}
        · {message.status}
      </Text>
      {message.sections.length === 0 ? (
        <Card padding={4}>
          <Text type="body">{message.body ?? "This message has no text."}</Text>
        </Card>
      ) : (
        message.sections.map((s) => (
          <Card key={s.title} padding={4}>
            <VStack gap={2} hAlign="stretch">
              <Heading level={3}>{s.title}</Heading>
              {s.items.map((item) => (
                <Text key={item.number} type="body">
                  {item.number}. {item.text}
                  {item.finding_id ? (
                    <>
                      {" "}
                      <Link
                        href={`/venues/${venueId}/findings/${item.finding_id}`}
                      >
                        See the evidence
                      </Link>
                    </>
                  ) : null}
                </Text>
              ))}
            </VStack>
          </Card>
        ))
      )}
    </VStack>
  );
}
