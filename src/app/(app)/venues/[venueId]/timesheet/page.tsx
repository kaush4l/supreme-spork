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
import { fetchTimesheet, staffOptions } from "@/server/data/timesheet";
import { formatHours, formatMoney, formatTime } from "@/server/format";
import { can } from "@/server/nav";
import { CorrectForm } from "./correct-form";
import { EntryForm } from "./entry-form";
import { chooseRange, todayIn } from "./range";
import { RangeForm } from "./range-form";

export const metadata = { title: "Timesheet" };

export default async function TimesheetPage({
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
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const { from, to } = chooseRange(
    query.from,
    query.to,
    todayIn(new Date(), tz),
  );
  const here = `/venues/${venueId}/timesheet?from=${from}&to=${to}`;
  const rights = await myRights(token, venueId, here);
  const mayCorrect = can(rights, "timesheet.correct");
  const [sheet, staff] = await Promise.all([
    fetchTimesheet(token, venueId, from, to, here),
    mayCorrect ? staffOptions(token, venueId, here) : Promise.resolve([]),
  ]);
  const showPay = sheet.lines.some((l) => l.cost_cents != null);

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Timesheet</Heading>
      <RangeForm venueId={venueId} from={from} to={to} />
      <Link
        href={`/venues/${venueId}/timesheet/csv?from=${from}&to=${to}`}
        download
      >
        Download as a spreadsheet (CSV)
      </Link>
      {sheet.people.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nobody clocked in between {from} and {to}.
        </Text>
      ) : null}
      {sheet.people.map((p) => (
        <Card key={p.staff_ref} padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={3}>{p.name}</Heading>
            <Text type="body">
              Total {formatHours(p.hours)}
              {showPay && p.cost_cents != null
                ? `, ${formatMoney(p.cost_cents)}`
                : ""}
              {p.incomplete > 0 ? ` (${p.incomplete} without a clock-out)` : ""}
            </Text>
            {sheet.lines
              .filter((l) => l.staff_ref === p.staff_ref)
              .map((l) => (
                <VStack
                  key={`${l.clock_in}-${l.staff_ref}`}
                  gap={1}
                  hAlign="stretch"
                >
                  <Text type="supporting" color="secondary">
                    {l.date}: in {formatTime(l.clock_in, tz)}, out{" "}
                    {l.clock_out ? formatTime(l.clock_out, tz) : "not yet"},
                    break {l.break_minutes} min,{" "}
                    {l.hours != null ? formatHours(l.hours) : "incomplete"}
                    {showPay && l.cost_cents != null
                      ? `, ${formatMoney(l.cost_cents)}`
                      : ""}
                    {l.rostered === false ? ", no shift planned" : ""}
                  </Text>
                  {mayCorrect ? (
                    <CorrectForm
                      venueId={venueId}
                      clockInId={l.clock_in_id ?? null}
                      clockOutId={l.clock_out_id ?? null}
                      clockIn={l.clock_in}
                      clockOut={l.clock_out}
                      breakMinutes={l.break_minutes}
                      timeZone={tz}
                    />
                  ) : null}
                </VStack>
              ))}
          </VStack>
        </Card>
      ))}
      {mayCorrect ? (
        <EntryForm
          venueId={venueId}
          staff={staff.map((s) => ({ value: s.id, label: s.name }))}
        />
      ) : null}
    </VStack>
  );
}
