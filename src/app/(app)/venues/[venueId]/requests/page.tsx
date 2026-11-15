import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myBlackouts, myColleagues, myRequests } from "@/server/data/requests";
import { myUpcomingShifts } from "@/server/data/shifts";
import { formatDay, formatSpan } from "@/server/format";
import { LeaveForm, SwapForm } from "./request-forms";
import { formatDateSpan, KIND_WORDS, requestWord } from "./words";

export const metadata = { title: "My requests" };

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/requests`;
  const token = principal.accessToken;
  const [me, requests, blackouts, colleagues, shifts] = await Promise.all([
    fetchMe(backend(token)),
    myRequests(token, venueId, here),
    myBlackouts(token, venueId, here),
    myColleagues(token, venueId, here),
    myUpcomingShifts(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const now = Date.now();
  const swappable = shifts
    .filter((s) => new Date(s.start).getTime() > now)
    .map((s) => ({
      value: s.external_id,
      label: `${formatDay(s.start, tz)}, ${formatSpan(s.start, s.end, tz)}${s.position ? ` (${s.position})` : ""}`,
    }));
  const people = colleagues.map((c) => ({
    value: c.id,
    label: c.position_names?.length
      ? `${c.name} (${c.position_names.join(", ")})`
      : c.name,
  }));

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>My requests</Heading>

      <VStack gap={2} hAlign="stretch">
        {requests.length === 0 ? (
          <Text type="supporting" color="secondary">
            You have not asked for anything yet.
          </Text>
        ) : (
          requests.map((r) => (
            <Card key={r.id} padding={4}>
              <VStack gap={1} hAlign="stretch">
                <Text type="body">{r.description}</Text>
                <Text type="supporting" color="secondary">
                  {KIND_WORDS[r.kind] ?? r.kind} · {requestWord(r.status)}
                </Text>
                {r.note ? (
                  <Text type="supporting" color="secondary">
                    Manager said: {r.note}
                  </Text>
                ) : null}
              </VStack>
            </Card>
          ))
        )}
      </VStack>

      {blackouts.length > 0 ? (
        <Card padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Text type="body">Leave cannot be asked for on these dates:</Text>
            {blackouts.map((b) => (
              <Text key={b.id} type="supporting" color="secondary">
                {formatDateSpan(b.start_date, b.end_date)}: {b.reason}
              </Text>
            ))}
          </VStack>
        </Card>
      ) : null}
      <LeaveForm venueId={venueId} />

      {swappable.length === 0 ? (
        <Card padding={4}>
          <Text type="supporting" color="secondary">
            You have no coming shifts to hand over.
          </Text>
        </Card>
      ) : (
        <SwapForm venueId={venueId} shifts={swappable} colleagues={people} />
      )}
    </VStack>
  );
}
