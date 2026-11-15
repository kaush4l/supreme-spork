import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { actionWords, listChangeRequests } from "@/server/data/changes";
import { formatDay, formatTime } from "@/server/format";
import { RequestCard, type RequestLine } from "./request-card";

export const metadata = { title: "Change requests" };

export default async function ChangesPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/changes`;
  const token = principal.accessToken;
  const [me, requests] = await Promise.all([
    fetchMe(backend(token)),
    listChangeRequests(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const lines: RequestLine[] = requests.map((r) => {
    const mine = r.requested_by !== null && r.requested_by === me.user?.id;
    return {
      id: r.id,
      actionLabel: actionWords(r.action),
      summary: r.summary,
      who: mine ? "you" : (r.requested_by_name ?? "a team member"),
      whenLabel: `${formatDay(r.requested_at, tz)} ${formatTime(r.requested_at, tz)}`,
      status: r.status,
      statusLabel: r.status_label,
      mine,
      note: r.note,
    };
  });
  const waiting = lines.filter((l) => l.status === "pending");
  const decided = lines.filter((l) => l.status !== "pending");
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Change requests</Heading>
      <Text type="supporting" color="secondary">
        Some changes, such as a pay rate, wait here for approval before they
        happen.
      </Text>
      <Heading level={2}>Waiting for approval</Heading>
      {waiting.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nothing is waiting.
        </Text>
      ) : (
        waiting.map((r) => (
          <RequestCard key={r.id} venueId={venueId} request={r} />
        ))
      )}
      {decided.length > 0 ? (
        <>
          <Heading level={2}>Earlier</Heading>
          {decided.map((r) => (
            <RequestCard key={r.id} venueId={venueId} request={r} />
          ))}
        </>
      ) : null}
    </VStack>
  );
}
