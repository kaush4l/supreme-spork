import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myNotices, NOTICE_PAGE_SIZE } from "@/server/data/notices";
import { formatDay, formatTime } from "@/server/format";
import { MarkReadButton } from "./mark-read-button";

export const metadata = { title: "Notices" };

export default async function NoticesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const { offset: rawOffset } = await searchParams;
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .catch(0)
    .parse(rawOffset ?? 0);
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/notices`;
  const token = principal.accessToken;
  const [me, page] = await Promise.all([
    fetchMe(backend(token)),
    myNotices(token, venueId, offset, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const hasMore = offset + page.items.length < page.total;

  return (
    <VStack gap={4} hAlign="stretch">
      <HStack gap={2} vAlign="center">
        <Heading level={1}>Notices</Heading>
        {page.unread > 0 ? (
          <Badge variant="info" label={`${page.unread} new`} />
        ) : null}
      </HStack>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {offset > 0 ? "No more notices." : "You have no notices."}
        </Text>
      ) : (
        page.items.map((n) => (
          <Card key={n.id} padding={4}>
            <VStack gap={2} hAlign="stretch">
              <Text type="body">{n.read ? n.title : `New: ${n.title}`}</Text>
              <Text type="supporting" color="secondary">
                {n.body}
              </Text>
              <Text type="supporting" color="secondary">
                {formatDay(n.created_at, tz)} {formatTime(n.created_at, tz)}
              </Text>
              {n.issued_list_id ? (
                <Link href={`/venues/${venueId}/lists/${n.issued_list_id}`}>
                  Open the list
                </Link>
              ) : null}
              {n.read ? null : <MarkReadButton venueId={venueId} id={n.id} />}
            </VStack>
          </Card>
        ))
      )}
      <HStack gap={4}>
        {offset > 0 ? (
          <Link
            href={`/venues/${venueId}/notices?offset=${Math.max(0, offset - NOTICE_PAGE_SIZE)}`}
          >
            Newer
          </Link>
        ) : null}
        {hasMore ? (
          <Link
            href={`/venues/${venueId}/notices?offset=${offset + NOTICE_PAGE_SIZE}`}
          >
            Older
          </Link>
        ) : null}
      </HStack>
    </VStack>
  );
}
