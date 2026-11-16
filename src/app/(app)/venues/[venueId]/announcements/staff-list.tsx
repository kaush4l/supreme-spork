import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import {
  ANNOUNCEMENT_PAGE_SIZE,
  myAnnouncements,
} from "@/server/data/announcements";
import { formatDay, formatTime } from "@/server/format";

/** The announcements this person was told, newest first, with the unread ones marked. */
export async function StaffList({
  token,
  venueId,
  offset,
}: {
  token: string;
  venueId: string;
  offset: number;
}) {
  const here = `/venues/${venueId}/announcements`;
  const [me, page] = await Promise.all([
    fetchMe(backend(token)),
    myAnnouncements(token, venueId, offset, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const hasMore = offset + page.items.length < page.total;
  return (
    <VStack gap={4} hAlign="stretch">
      <HStack gap={2} vAlign="center">
        <Heading level={1}>Announcements</Heading>
        {page.unread > 0 ? (
          <Badge variant="info" label={`${page.unread} new`} />
        ) : null}
      </HStack>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {offset > 0 ? "No more announcements." : "No announcements yet."}
        </Text>
      ) : (
        page.items.map((a) => {
          const withdrawn = a.status === "withdrawn";
          const isNew = !a.read && a.status === "active";
          return (
            <Card
              key={a.id}
              padding={4}
              variant={withdrawn ? "muted" : "default"}
            >
              <VStack gap={1} hAlign="stretch">
                <Link href={`${here}/${a.id}`}>
                  {isNew ? `New: ${a.title}` : a.title}
                </Link>
                {withdrawn ? (
                  <Text type="supporting" color="secondary">
                    This announcement was withdrawn.
                  </Text>
                ) : null}
                <Text type="supporting" color="secondary">
                  {formatDay(a.sent_at, tz)} {formatTime(a.sent_at, tz)}
                </Text>
              </VStack>
            </Card>
          );
        })
      )}
      <HStack gap={4}>
        {offset > 0 ? (
          <Link
            href={`${here}?offset=${Math.max(0, offset - ANNOUNCEMENT_PAGE_SIZE)}`}
          >
            Newer
          </Link>
        ) : null}
        {hasMore ? (
          <Link href={`${here}?offset=${offset + ANNOUNCEMENT_PAGE_SIZE}`}>
            Older
          </Link>
        ) : null}
      </HStack>
    </VStack>
  );
}
