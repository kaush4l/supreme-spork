import { Banner } from "@astryxdesign/core/Banner";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchReadings } from "@/server/data/readings";
import { chooseRange, todayIn } from "../timesheet/range";
import { RangeForm } from "./range-form";
import { ReadingsTable } from "./readings-table";
import { readingRow } from "./rows";

export const metadata = { title: "Readings log" };

export default async function ReadingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const me = await fetchMe(backend(token));
  const venue = me.venues.find((v) => v.id === venueId);
  const tz = venue?.timezone ?? "Australia/Sydney";
  const { from, to } = chooseRange(
    query.from,
    query.to,
    todayIn(new Date(), tz),
  );
  const here = `/venues/${venueId}/readings?from=${from}&to=${to}`;
  const result = await fetchReadings(token, venueId, from, to, here);

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Readings log</Heading>
      <Text type="supporting" color="secondary">
        Every saved reading of a checklist item that has a number to stay
        within, such as a fridge or freezer temperature. Up to 31 days at a
        time.
      </Text>
      <RangeForm venueId={venueId} from={from} to={to} />
      {result.ok ? (
        <>
          <Link
            href={`/venues/${venueId}/readings/csv?from=${from}&to=${to}`}
            download
          >
            Download as a spreadsheet (CSV)
          </Link>
          <Text type="body">
            {venue ? `${venue.name}: ` : ""}
            {result.readings.total}{" "}
            {result.readings.total === 1 ? "reading" : "readings"} from{" "}
            {result.readings.from} to {result.readings.to}
          </Text>
          {result.readings.items.length === 0 ? (
            <Text type="supporting" color="secondary">
              No readings were saved between {from} and {to}.
            </Text>
          ) : (
            <ReadingsTable
              venueId={venueId}
              rows={result.readings.items.map((r) => readingRow(r, tz))}
            />
          )}
        </>
      ) : (
        <Banner status="error" title={result.message} />
      )}
    </VStack>
  );
}
