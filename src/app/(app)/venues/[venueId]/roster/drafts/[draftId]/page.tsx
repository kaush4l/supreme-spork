import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { type Reply, rosterDraftBoard } from "@/server/data/roster-extras";
import { formatDay, formatSpan, formatTime } from "@/server/format";
import { can } from "@/server/nav";
import { DraftActions, ReplyButtons } from "./draft-buttons";

export const metadata = { title: "Draft roster" };

const STATE_WORDS: Record<string, string> = {
  open: "Out for replies",
  published: "Published",
  cancelled: "Cancelled",
};

export default async function DraftPage({
  params,
}: {
  params: Promise<{ venueId: string; draftId: string }>;
}) {
  const { venueId, draftId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(draftId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/roster/drafts/${draftId}`;
  const [me, rights, board] = await Promise.all([
    fetchMe(backend(token)),
    myRights(token, venueId, here),
    rosterDraftBoard(token, venueId, draftId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const day = (iso: string) => formatDay(iso, tz);
  const open = board.state === "open";

  const replyWords = (r: Reply | null): string => {
    if (!r) return "No reply yet";
    const auto = r.source === "job" ? " (counted automatically)" : "";
    if (r.response === "accept") return `Accepted${auto}`;
    if (r.response === "decline")
      return `Declined${r.reason ? `: ${r.reason}` : ""}`;
    if (r.response === "propose") {
      const when =
        r.proposed_start && r.proposed_end
          ? `${day(r.proposed_start)}, ${formatSpan(r.proposed_start, r.proposed_end, tz)}`
          : "another time";
      const decided =
        r.decision === "approved"
          ? " (you agreed)"
          : r.decision === "rejected"
            ? " (you said no)"
            : "";
      return `Would rather work ${when}${decided}${r.reason ? `. ${r.reason}` : ""}`;
    }
    return "Wants to pick it up";
  };

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Draft roster</Heading>
      <Link href={`/venues/${venueId}/roster?week=${board.week_start}`}>
        Back to the roster for this week
      </Link>
      <Card padding={4}>
        <VStack gap={1} hAlign="stretch">
          <Text type="body">
            Week of {day(`${board.week_start}T12:00:00Z`)}:{" "}
            {STATE_WORDS[board.state] ?? board.state}
          </Text>
          {board.reply_by ? (
            <Text type="supporting" color="secondary">
              Reply by {day(board.reply_by)}, {formatTime(board.reply_by, tz)}
            </Text>
          ) : (
            <Text type="supporting" color="secondary">
              There is no reply time.
            </Text>
          )}
          <Text type="supporting" color="secondary">
            Accepted {board.counts.accepted} · Declined {board.counts.declined}{" "}
            · Other times {board.counts.proposals} · Pick-ups{" "}
            {board.counts.pickups} · No reply {board.counts.no_reply}
          </Text>
        </VStack>
      </Card>
      {open ? (
        <DraftActions
          venueId={venueId}
          draftId={draftId}
          canPublish={can(rights, "roster.publish")}
        />
      ) : null}

      <VStack gap={2} hAlign="stretch">
        <Heading level={2}>Shifts</Heading>
        {board.shifts.length === 0 ? (
          <Text type="body" color="secondary">
            No one has a shift in this draft.
          </Text>
        ) : (
          board.shifts.map((s) => (
            <Card key={s.shift.external_id} padding={4}>
              <VStack gap={1} hAlign="stretch">
                <Text type="body">
                  {s.name ?? "Someone"} · {s.shift.position ?? "Shift"}
                </Text>
                <Text type="supporting" color="secondary">
                  {day(s.shift.start)},{" "}
                  {formatSpan(s.shift.start, s.shift.end, tz)}
                </Text>
                <Text type="body">{replyWords(s.reply)}</Text>
                {open &&
                s.reply?.response === "propose" &&
                !s.reply.decision ? (
                  <ReplyButtons
                    venueId={venueId}
                    draftId={draftId}
                    replyId={s.reply.id}
                    yesLabel="Agree to the new time"
                  />
                ) : null}
              </VStack>
            </Card>
          ))
        )}
      </VStack>

      <VStack gap={2} hAlign="stretch">
        <Heading level={2}>Open shifts people want</Heading>
        {board.pickups.length === 0 ? (
          <Text type="body" color="secondary">
            Nobody has asked for an open shift.
          </Text>
        ) : (
          board.pickups.map((p) => (
            <Card key={p.shift.external_id} padding={4}>
              <VStack gap={2} hAlign="stretch">
                <Text type="body">
                  {p.shift.position ?? "Shift"} · {day(p.shift.start)},{" "}
                  {formatSpan(p.shift.start, p.shift.end, tz)}
                </Text>
                {p.claims.map((c) => (
                  <VStack key={c.id} gap={1} hAlign="stretch">
                    <Text type="body">
                      {c.name}
                      {c.decision === "approved"
                        ? " got it"
                        : c.decision === "rejected"
                          ? " was told not this time"
                          : " would like it"}
                    </Text>
                    {open && !c.decision ? (
                      <ReplyButtons
                        venueId={venueId}
                        draftId={draftId}
                        replyId={c.id}
                        yesLabel={`Give it to ${c.name}`}
                      />
                    ) : null}
                  </VStack>
                ))}
              </VStack>
            </Card>
          ))
        )}
      </VStack>
    </VStack>
  );
}
