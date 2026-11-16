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
import { myRosterDrafts } from "@/server/data/my-roster-drafts";
import { formatDay, formatTime } from "@/server/format";
import { DraftShiftCard } from "./draft-shift";

export const metadata = { title: "Draft rosters" };

export default async function DraftRostersPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/shifts/drafts`;
  const token = principal.accessToken;
  const [me, drafts] = await Promise.all([
    fetchMe(backend(token)),
    myRosterDrafts(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Draft rosters</Heading>
      <Text type="supporting" color="secondary">
        A draft is not final. Tell your manager if you can work your shifts.
        Your real shifts stay on My shifts until the roster is published.
      </Text>
      {drafts.length === 0 ? (
        <Card padding={4}>
          <Text type="body">No draft roster is waiting for your reply.</Text>
        </Card>
      ) : (
        drafts.map((d) => (
          <VStack key={d.id} gap={3} hAlign="stretch">
            <Banner
              status="warning"
              title={`Draft roster, week of ${formatDay(`${d.week_start}T00:00:00Z`, "UTC")}`}
              description={
                d.reply_by
                  ? `Not final. Please reply by ${formatDay(d.reply_by, tz)}, ${formatTime(d.reply_by, tz)}.`
                  : "Not final. There is no reply deadline."
              }
            />
            <Heading level={2}>Your shifts in this draft</Heading>
            {d.my_shifts.length === 0 ? (
              <Text type="supporting" color="secondary">
                You have no shifts in this draft.
              </Text>
            ) : (
              d.my_shifts.map((s) => (
                <DraftShiftCard
                  key={s.external_id}
                  venueId={venueId}
                  draftId={d.id}
                  shift={s}
                  timeZone={tz}
                  isOpenShift={false}
                  mayPropose={d.may_propose}
                  mayPickUp={d.may_pick_up}
                />
              ))
            )}
            {d.open_shifts.length > 0 ? (
              <VStack gap={2} hAlign="stretch">
                <Heading level={2}>Open shifts you could pick up</Heading>
                {d.open_shifts.map((s) => (
                  <DraftShiftCard
                    key={s.external_id}
                    venueId={venueId}
                    draftId={d.id}
                    shift={s}
                    timeZone={tz}
                    isOpenShift
                    mayPropose={d.may_propose}
                    mayPickUp={d.may_pick_up}
                  />
                ))}
              </VStack>
            ) : null}
          </VStack>
        ))
      )}
      <Link href={`/venues/${venueId}/shifts`}>Back to my shifts</Link>
    </VStack>
  );
}
