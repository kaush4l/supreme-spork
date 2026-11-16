import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import {
  ANNOUNCEMENT_PAGE_SIZE,
  listAnnouncements,
} from "@/server/data/announcements";
import { formatDay, formatTime } from "@/server/format";
import { audienceLine, noLoginLine, readLine, statusWords } from "./words";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Sent" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
];

/** The sent list for people with the right `announcements.send`: "read by N of M", status, and a way to send a new one. */
export async function ManagerList({
  token,
  venueId,
  status,
  offset,
}: {
  token: string;
  venueId: string;
  status: string;
  offset: number;
}) {
  const here = `/venues/${venueId}/announcements`;
  const [me, page] = await Promise.all([
    fetchMe(backend(token)),
    listAnnouncements(token, venueId, status, offset, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const hasMore = offset + page.items.length < page.total;
  const filterHref = (value: string) =>
    value === "all" ? here : `${here}?status=${value}`;
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Announcements</Heading>
      <HStack gap={2}>
        <Button
          label="New announcement"
          variant="primary"
          size="lg"
          href={`${here}/new`}
        />
      </HStack>
      <HStack gap={3} wrap="wrap">
        {FILTERS.map((f) =>
          f.value === status ? (
            <Text key={f.value} type="label">
              {f.label}
            </Text>
          ) : (
            <Link key={f.value} href={filterHref(f.value)}>
              {f.label}
            </Link>
          ),
        )}
      </HStack>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {offset > 0
            ? "No more announcements."
            : status === "all"
              ? "You have not sent any announcements yet."
              : "No announcements with that status."}
        </Text>
      ) : (
        page.items.map((a) => {
          const noLogin = noLoginLine(a);
          return (
            <Card key={a.id} padding={4}>
              <VStack gap={1} hAlign="stretch">
                <Link href={`${here}/${a.id}`}>{a.title}</Link>
                <Text type="body">
                  {a.status === "active" ? readLine(a) : statusWords(a.status)}
                </Text>
                <Text type="supporting" color="secondary">
                  {a.status === "active" ? "" : `${readLine(a)}. `}
                  {noLogin ?? ""}
                </Text>
                <Text type="supporting" color="secondary">
                  For: {audienceLine(a)}. Sent {formatDay(a.sent_at, tz)}{" "}
                  {formatTime(a.sent_at, tz)}
                  {a.created_by_name ? ` by ${a.created_by_name}` : ""}.
                </Text>
              </VStack>
            </Card>
          );
        })
      )}
      <HStack gap={4}>
        {offset > 0 ? (
          <Link
            href={`${filterHref(status)}${status === "all" ? "?" : "&"}offset=${Math.max(0, offset - ANNOUNCEMENT_PAGE_SIZE)}`}
          >
            Newer
          </Link>
        ) : null}
        {hasMore ? (
          <Link
            href={`${filterHref(status)}${status === "all" ? "?" : "&"}offset=${offset + ANNOUNCEMENT_PAGE_SIZE}`}
          >
            Older
          </Link>
        ) : null}
      </HStack>
    </VStack>
  );
}
