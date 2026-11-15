import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { ApiFailure } from "@/server/api/errors";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myHours } from "@/server/data/pay";
import { formatHours, formatMoney, formatTime } from "@/server/format";
import { formatDate, formatDateSpan } from "../requests/words";
import { RangeForm } from "./range-form";

export const metadata = { title: "My pay" };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const sp = await searchParams;
  const from = day.safeParse(sp.from).data;
  const to = day.safeParse(sp.to).data;
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/pay`;
  const token = principal.accessToken;
  const me = await fetchMe(backend(token));
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";

  let hours: Awaited<ReturnType<typeof myHours>> | null = null;
  let rangeProblem: string | null = null;
  try {
    hours = await myHours(token, venueId, from && to ? { from, to } : {}, here);
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 422) rangeProblem = e.message;
    else throw e;
  }

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>My pay</Heading>
      {hours ? (
        <>
          <Text type="supporting" color="secondary">
            {formatDateSpan(hours.from, hours.to)}
          </Text>
          <Banner status="info" title={hours.basis} />
          <Card padding={4}>
            <VStack gap={1} hAlign="stretch">
              <Text type="body">Hours worked: {formatHours(hours.hours)}</Text>
              <Text type="body">
                Estimated total:{" "}
                {hours.estimated_cents == null
                  ? "no rate set"
                  : formatMoney(hours.estimated_cents)}
              </Text>
              {hours.incomplete > 0 ? (
                <Text type="supporting" color="secondary">
                  {hours.incomplete} shift
                  {hours.incomplete === 1 ? " has" : "s have"} no clock out yet,
                  so it is not counted.
                </Text>
              ) : null}
            </VStack>
          </Card>
          {hours.lines.length === 0 ? (
            <Text type="supporting" color="secondary">
              No worked hours in these dates.
            </Text>
          ) : (
            hours.lines.map((l) => (
              <Card key={`${l.clock_in}`} padding={4}>
                <VStack gap={1} hAlign="stretch">
                  <Text type="body">{formatDate(l.date)}</Text>
                  <Text type="supporting" color="secondary">
                    In {formatTime(l.clock_in, tz)}
                    {l.clock_out
                      ? `, out ${formatTime(l.clock_out, tz)}`
                      : ", not clocked out yet"}
                    {l.break_minutes > 0
                      ? `, ${l.break_minutes} min break`
                      : ""}
                  </Text>
                  <Text type="supporting" color="secondary">
                    {l.hours == null
                      ? "Hours not known yet"
                      : formatHours(l.hours)}
                    {" · "}
                    {l.estimated_cents != null
                      ? formatMoney(l.estimated_cents)
                      : hours.rate_cents == null
                        ? "no rate set"
                        : "amount not known yet"}
                  </Text>
                </VStack>
              </Card>
            ))
          )}
        </>
      ) : null}
      {rangeProblem ? <Banner status="error" title={rangeProblem} /> : null}
      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <Heading level={2}>Other dates</Heading>
          <RangeForm
            venueId={venueId}
            from={hours?.from ?? from ?? ""}
            to={hours?.to ?? to ?? ""}
          />
        </VStack>
      </Card>
    </VStack>
  );
}
