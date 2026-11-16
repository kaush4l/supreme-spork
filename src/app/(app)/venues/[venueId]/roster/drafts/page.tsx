import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { rosterDrafts } from "@/server/data/roster-extras";
import { formatDay, formatTime } from "@/server/format";

export const metadata = { title: "Draft rosters" };

const STATE_WORDS: Record<string, string> = {
  open: "Out for replies",
  published: "Published",
  cancelled: "Cancelled",
};

export default async function DraftsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/roster/drafts`;
  const [me, drafts] = await Promise.all([
    fetchMe(backend(token)),
    rosterDrafts(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Draft rosters</Heading>
      <Link href={`/venues/${venueId}/roster`}>Back to the roster</Link>
      <Text type="supporting" color="secondary">
        Weeks you sent to the team to reply to, newest first.
      </Text>
      {drafts.length === 0 ? (
        <Text type="body" color="secondary">
          You have not sent a draft yet. Open a week on the roster and choose
          Send as draft.
        </Text>
      ) : (
        drafts.map((d) => (
          <Card key={d.id} padding={4}>
            <VStack gap={1} hAlign="stretch">
              <Link href={`${here}/${d.id}`}>
                Week of {formatDay(`${d.week_start}T12:00:00Z`, "UTC")}
              </Link>
              <Text type="supporting" color="secondary">
                {STATE_WORDS[d.state] ?? d.state} · sent{" "}
                {formatDay(d.created_at, tz)}, {formatTime(d.created_at, tz)}
                {d.reply_by && d.state === "open"
                  ? ` · reply by ${formatDay(d.reply_by, tz)}`
                  : ""}
              </Text>
            </VStack>
          </Card>
        ))
      )}
    </VStack>
  );
}
