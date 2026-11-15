import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myOffers, myUpcomingShifts } from "@/server/data/shifts";
import { formatDay, formatHours, formatSpan } from "@/server/format";
import { groupByDay, offerState } from "./group";
import { ShiftButton } from "./shift-buttons";

export const metadata = { title: "My shifts" };

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/shifts`;
  const token = principal.accessToken;
  const [me, shifts, allOffers] = await Promise.all([
    fetchMe(backend(token)),
    myUpcomingShifts(token, venueId, here),
    myOffers(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const now = Date.now();
  // an offer for a shift that was cancelled in the meantime is no use to anyone
  const offers = allOffers.filter((o) => o.shift.status !== "cancelled");
  const mine = offers.filter((o) => o.mine);
  const inPool = new Set(mine.map((o) => o.shift.external_id));
  const couldTake = offers.filter((o) => !o.mine);
  const days = groupByDay(
    shifts.filter((s) => new Date(s.end).getTime() > now),
    tz,
  );

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>My shifts</Heading>
      <Text type="supporting" color="secondary">
        The next 14 days.
      </Text>
      {days.length === 0 ? (
        <Card padding={4}>
          <Text type="body">You have no shifts coming up.</Text>
        </Card>
      ) : (
        days.map((day) => (
          <VStack key={day.key} gap={2} hAlign="stretch">
            <Heading level={2}>{day.label}</Heading>
            {day.items.map((s) => (
              <Card key={s.external_id} padding={4}>
                <VStack gap={2} hAlign="stretch">
                  <Text type="body">{formatSpan(s.start, s.end, tz)}</Text>
                  <Text type="supporting" color="secondary">
                    {[
                      s.position,
                      s.hours != null ? formatHours(s.hours) : null,
                      s.break_minutes > 0
                        ? `${s.break_minutes} min break`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {inPool.has(s.external_id) ? (
                    <Text type="supporting" color="secondary">
                      You put this in the pool. It stays yours until a colleague
                      is given it.
                    </Text>
                  ) : new Date(s.start).getTime() > now ? (
                    <ShiftButton
                      kind="drop"
                      venueId={venueId}
                      id={s.external_id}
                    />
                  ) : null}
                </VStack>
              </Card>
            ))}
          </VStack>
        ))
      )}

      {mine.length > 0 ? (
        <VStack gap={2} hAlign="stretch">
          <Heading level={2}>Shifts you put in the pool</Heading>
          {mine.map((o) => (
            <Card key={o.id} padding={4}>
              <VStack gap={2} hAlign="stretch">
                <Text type="body">
                  {formatDay(o.shift.start, tz)},{" "}
                  {formatSpan(o.shift.start, o.shift.end, tz)}
                </Text>
                <Text type="supporting" color="secondary">
                  {offerState(o)}
                </Text>
                <ShiftButton kind="withdraw" venueId={venueId} id={o.id} />
              </VStack>
            </Card>
          ))}
        </VStack>
      ) : null}

      <VStack gap={2} hAlign="stretch">
        <Heading level={2}>Shifts you could pick up</Heading>
        {couldTake.length === 0 ? (
          <Text type="supporting" color="secondary">
            Nothing is on offer right now.
          </Text>
        ) : (
          couldTake.map((o) => (
            <Card key={o.id} padding={4}>
              <VStack gap={2} hAlign="stretch">
                <Text type="body">
                  {formatDay(o.shift.start, tz)},{" "}
                  {formatSpan(o.shift.start, o.shift.end, tz)}
                </Text>
                <Text type="supporting" color="secondary">
                  {[
                    o.shift.position,
                    o.shift.hours != null ? formatHours(o.shift.hours) : null,
                    o.offered_by ? `from ${o.offered_by}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Text type="supporting" color="secondary">
                  {offerState(o)}
                </Text>
                {o.my_claim === null ? (
                  <ShiftButton kind="claim" venueId={venueId} id={o.id} />
                ) : o.my_claim.decision === null ? (
                  <ShiftButton
                    kind="withdrawClaim"
                    venueId={venueId}
                    id={o.id}
                  />
                ) : null}
              </VStack>
            </Card>
          ))
        )}
      </VStack>
    </VStack>
  );
}
