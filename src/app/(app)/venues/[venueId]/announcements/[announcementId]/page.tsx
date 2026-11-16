import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { getAnnouncement, myAnnouncement } from "@/server/data/announcements";
import { myRights } from "@/server/data/me";
import { formatDay, formatTime } from "@/server/format";
import { can } from "@/server/nav";
import {
  audienceLine,
  noLoginLine,
  readLine,
  receiptWords,
  statusWords,
} from "../words";
import { ManagerActions } from "./manager-actions";

export const metadata = { title: "Announcement" };

/** One address for both: people who may send see the receipts, everyone else open the announcement (which marks it read). */
export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ venueId: string; announcementId: string }>;
}) {
  const { venueId, announcementId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(announcementId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/announcements/${announcementId}`;
  const token = principal.accessToken;
  const [me, rights] = await Promise.all([
    fetchMe(backend(token)),
    myRights(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const list = `/venues/${venueId}/announcements`;

  if (!can(rights, "announcements.send")) {
    const a = await myAnnouncement(token, venueId, announcementId, here);
    const withdrawn = a.status === "withdrawn";
    return (
      <VStack gap={4} hAlign="stretch">
        <Link href={list}>All announcements</Link>
        <Heading level={1}>{a.title}</Heading>
        <Text type="supporting" color="secondary">
          {formatDay(a.sent_at, tz)} {formatTime(a.sent_at, tz)}
        </Text>
        {withdrawn ? (
          <Banner status="info" title="This announcement was withdrawn" />
        ) : (
          <Card padding={4}>
            <VStack gap={2} hAlign="stretch">
              {a.status === "expired" ? (
                <Text type="supporting" color="secondary">
                  This announcement has expired.
                </Text>
              ) : null}
              <Text type="body">{a.body}</Text>
            </VStack>
          </Card>
        )}
      </VStack>
    );
  }

  const a = await getAnnouncement(token, venueId, announcementId, here);
  const noLogin = noLoginLine(a);
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={list}>All announcements</Link>
      <Heading level={1}>{a.title}</Heading>
      <Text type="supporting" color="secondary">
        {statusWords(a.status)}. For: {audienceLine(a)}. Sent{" "}
        {formatDay(a.sent_at, tz)} {formatTime(a.sent_at, tz)}
        {a.created_by_name ? ` by ${a.created_by_name}` : ""}.
        {a.withdrawn_at
          ? ` Withdrawn ${formatDay(a.withdrawn_at, tz)} ${formatTime(a.withdrawn_at, tz)}.`
          : ""}
      </Text>
      <Card padding={4}>
        <Text type="body">{a.body}</Text>
      </Card>
      <ManagerActions
        venueId={venueId}
        announcementId={announcementId}
        withdrawn={a.status === "withdrawn"}
      />
      <Heading level={2}>Who has read it</Heading>
      <Text type="body">{readLine(a)}</Text>
      {noLogin ? (
        <Text type="supporting" color="secondary">
          {noLogin}
        </Text>
      ) : null}
      {a.reminders.length > 0 ? (
        <Text type="supporting" color="secondary">
          Reminded:{" "}
          {a.reminders
            .map(
              (r) =>
                `${formatDay(r.at, tz)} ${formatTime(r.at, tz)} (${r.notified} ${r.notified === 1 ? "person" : "people"})`,
            )
            .join(", ")}
          .
        </Text>
      ) : null}
      {a.people.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nobody was in this audience.
        </Text>
      ) : (
        <Card padding={4}>
          <VStack gap={2} hAlign="stretch">
            {a.people.map((p) => (
              <Text key={p.staff_ref} type="body">
                {p.name}: {receiptWords(p.state)}
                {p.state === "read" && p.read_at
                  ? ` ${formatDay(p.read_at, tz)} ${formatTime(p.read_at, tz)}`
                  : ""}
              </Text>
            ))}
          </VStack>
        </Card>
      )}
    </VStack>
  );
}
