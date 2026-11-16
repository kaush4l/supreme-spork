import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchFinding, fetchSources } from "@/server/data/insights";
import { formatMoney } from "@/server/format";
import { rowCells } from "../../pnl/sources/columns";
import { factLines, groupWords, NO_CAUSE, whyLines } from "./rows";

export const metadata = { title: "Finding" };

export default async function FindingPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string; findingId: string }>;
  searchParams: Promise<{ group?: string; offset?: string }>;
}) {
  const { venueId, findingId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(findingId).success) notFound();
  const query = await searchParams;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/findings/${findingId}`;
  const finding = await fetchFinding(token, venueId, findingId, here);
  const me = await fetchMe(backend(token));
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const groups = Object.keys(finding.sources);
  const group =
    query.group && groups.includes(query.group) ? query.group : groups[0];
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const rows = group
    ? await fetchSources(token, venueId, findingId, group, offset, here)
    : null;
  const facts = factLines(finding.facts);
  const why = whyLines(finding.kind, finding.causes, finding.facts);
  const link = (g: string, to: number) => `${here}?group=${g}&offset=${to}`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/week?week=${finding.week_start}`}>
        Back to this week
      </Link>
      <Heading level={1}>{finding.label}</Heading>
      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <HStack gap={2} wrap="wrap">
            <Badge label={finding.status_label} variant="neutral" />
            {finding.current ? null : (
              <Badge label="An older version" variant="warning" />
            )}
          </HStack>
          <Text type="supporting" color="secondary">
            {finding.status_help}
          </Text>
          <Text type="body">Week starting {finding.week_start}.</Text>
          {finding.value_cents === null ? null : (
            <Text type="body">Amount: {formatMoney(finding.value_cents)}</Text>
          )}
          {finding.value_pct === null ? null : (
            <Text type="body">Share: {finding.value_pct}%</Text>
          )}
          {finding.narration ? (
            <Text type="body">{finding.narration}</Text>
          ) : null}
        </VStack>
      </Card>

      {why && (why.causes.length > 0 || why.overTarget) ? (
        <>
          <Heading level={2}>Why</Heading>
          {why.causes.length === 0 ? (
            <Text type="body">{NO_CAUSE}</Text>
          ) : (
            <Card padding={4}>
              <VStack gap={2} hAlign="stretch">
                {why.causes.map((c) => (
                  <Text key={`${c.kind}|${c.text}`} type="body">
                    {c.text} ({formatMoney(c.cents)})
                  </Text>
                ))}
              </VStack>
            </Card>
          )}
        </>
      ) : null}

      <Heading level={2}>How it was worked out</Heading>
      {facts.length === 0 ? (
        <Text type="supporting" color="secondary">
          No working was kept for this finding.
        </Text>
      ) : (
        <Card padding={4}>
          <VStack gap={1} hAlign="stretch">
            {facts.map((l) => (
              <Text key={`${l.label}|${l.value}`} type="supporting">
                {l.label}: {l.value}
              </Text>
            ))}
          </VStack>
        </Card>
      )}

      <Heading level={2}>The rows behind it</Heading>
      {groups.length === 0 ? (
        <Text type="supporting" color="secondary">
          No rows are linked to this finding.
        </Text>
      ) : (
        <HStack gap={4} wrap="wrap">
          {groups.map((g) =>
            g === group ? (
              <Text key={g} type="body">
                {groupWords(g)} ({finding.sources[g]})
              </Text>
            ) : (
              <Link key={g} href={link(g, 0)}>
                {groupWords(g)} ({finding.sources[g]})
              </Link>
            ),
          )}
        </HStack>
      )}
      {rows && group ? (
        <VStack gap={2} hAlign="stretch">
          {rows.columns.length === 0 && rows.items.length > 0 ? (
            <Text type="supporting" color="secondary">
              This answer does not say how to show these rows. Reload the page
              to try again.
            </Text>
          ) : null}
          {rows.items.length === 0 ? (
            <Text type="supporting" color="secondary">
              No rows to show here.
            </Text>
          ) : (
            rows.items.map((row, i) => (
              <Card key={String(row.id ?? i)} padding={4}>
                <VStack gap={1} hAlign="stretch">
                  {rowCells(rows.columns, row, tz).map((l) => (
                    <Text key={l.label} type="supporting">
                      {l.label}: {l.text}
                    </Text>
                  ))}
                  {group === "findings" && typeof row.id === "string" ? (
                    <Link href={`/venues/${venueId}/findings/${row.id}`}>
                      Open this finding
                    </Link>
                  ) : null}
                </VStack>
              </Card>
            ))
          )}
          <Text type="supporting" color="secondary">
            {rows.total === 0
              ? "No rows."
              : `Rows ${rows.offset + 1} to ${rows.offset + rows.items.length} of ${rows.total}.`}
          </Text>
          <HStack gap={4} wrap="wrap">
            {rows.offset > 0 ? (
              <Link href={link(group, Math.max(0, rows.offset - rows.limit))}>
                Earlier rows
              </Link>
            ) : null}
            {rows.offset + rows.items.length < rows.total ? (
              <Link href={link(group, rows.offset + rows.limit)}>
                More rows
              </Link>
            ) : null}
          </HStack>
        </VStack>
      ) : null}
    </VStack>
  );
}
