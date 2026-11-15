import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchSources } from "@/server/data/pnl";
import { isDay } from "../../timesheet/range";
import { chooseOffset } from "../range";
import { rowCells } from "./columns";
import { groupTitle } from "./rows";

export const metadata = { title: "Rows behind a line" };

export default async function SourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{
    line?: string;
    from?: string;
    to?: string;
    group?: string;
    offset?: string;
  }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const q = await searchParams;
  if (!q.line || !isDay(q.from) || !isDay(q.to)) notFound();
  const { line, from, to } = { line: q.line, from: q.from, to: q.to };
  const group = q.group && /^[a-z_]{1,20}$/.test(q.group) ? q.group : undefined;
  const offset = chooseOffset(q.offset);
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const me = await fetchMe(backend(token));
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const base = `/venues/${venueId}/pnl/sources?line=${encodeURIComponent(line)}&from=${from}&to=${to}${group ? `&group=${group}` : ""}`;
  const result = await fetchSources(
    token,
    venueId,
    line,
    from,
    to,
    group,
    offset,
    `${base}&offset=${offset}`,
  );
  const back = `/venues/${venueId}/pnl?from=${from}&to=${to}`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Rows behind a line</Heading>
      <Link href={back}>Back to profit and loss</Link>
      {!result.ok ? (
        <Banner status="error" title={result.message} />
      ) : (
        <>
          <Text type="body">
            {groupTitle(result.rows.group)} for {from} to {to}:{" "}
            {result.rows.total} in all.
          </Text>
          {result.rows.columns.length === 0 && result.rows.items.length > 0 ? (
            <Text type="supporting" color="secondary">
              This answer does not say how to show these rows. Reload the page
              to try again.
            </Text>
          ) : null}
          {result.rows.items.length === 0 ? (
            <Text type="supporting" color="secondary">
              There are no rows to show here.
            </Text>
          ) : null}
          {(result.rows.columns.length === 0 ? [] : result.rows.items).map(
            (row, i) => (
              <Card key={String(row.id ?? i)} padding={3}>
                <VStack gap={1} hAlign="stretch">
                  {rowCells(result.rows.columns, row, tz).map((c) => (
                    <Text key={c.label} type="supporting">
                      {c.label}: {c.text}
                    </Text>
                  ))}
                </VStack>
              </Card>
            ),
          )}
          {result.rows.total > 0 ? (
            <HStack gap={4}>
              {result.rows.offset > 0 ? (
                <Link
                  href={`${base}&offset=${Math.max(0, result.rows.offset - result.rows.limit)}`}
                >
                  Earlier rows
                </Link>
              ) : null}
              <Text type="supporting" color="secondary">
                Rows {result.rows.offset + 1} to{" "}
                {result.rows.offset + result.rows.items.length}
              </Text>
              {result.rows.offset + result.rows.items.length <
              result.rows.total ? (
                <Link
                  href={`${base}&offset=${result.rows.offset + result.rows.limit}`}
                >
                  More rows
                </Link>
              ) : null}
            </HStack>
          ) : null}
        </>
      )}
    </VStack>
  );
}
