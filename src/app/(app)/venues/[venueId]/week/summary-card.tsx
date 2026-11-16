import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import type { Figure, Summary } from "@/server/data/summary";
import { formatDay, formatMoney, formatTime } from "@/server/format";
import { figureWords, targetWords } from "./words";

function FigureRow({
  figure,
  extra,
}: {
  figure: Figure;
  extra?: string | null;
}) {
  return (
    <VStack gap={1} hAlign="stretch">
      <Text type="body">
        {figure.label}:{" "}
        {figure.amount_cents === null
          ? "not available"
          : formatMoney(figure.amount_cents)}
        {extra ? `, ${extra}` : ""}
      </Text>
      {figure.status !== "complete" ? (
        <Badge label={figureWords(figure.status)} variant="warning" />
      ) : null}
      {figure.note ? (
        <Text type="supporting" color="secondary">
          {figure.note}
        </Text>
      ) : null}
    </VStack>
  );
}

/** The summary for one day, every figure and word as the API sent it. */
export function SummaryCard({
  summary,
  venueId,
  tz,
  links,
}: {
  summary: Summary;
  venueId: string;
  tz: string;
  /** Attention key to page address, only for pages the person may open. */
  links: Record<string, string>;
}) {
  const { labour, prime_cost: prime } = summary;
  return (
    <VStack gap={3} hAlign="stretch">
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Day: {summary.day}</Heading>
          <Text type="supporting" color="secondary">
            {summary.stored && summary.stored_at
              ? `Saved ${formatDay(summary.stored_at, tz)} ${formatTime(summary.stored_at, tz)}, version ${summary.versions}.`
              : (summary.stored_note ?? "Not saved yet.")}
          </Text>
          <FigureRow figure={summary.sales.net_sales} />
          {summary.sales.channels.map((c) => (
            <FigureRow key={c.key ?? c.label} figure={c} />
          ))}
          <FigureRow figure={summary.purchases} />
          <FigureRow
            figure={labour}
            extra={
              labour.labour_pct === null
                ? null
                : `${labour.labour_pct}% of sales (target ${labour.target_pct}%, ${targetWords(labour.vs_target)})`
            }
          />
          {labour.top_cause ? (
            <Text type="supporting" color="secondary">
              Main reason: {labour.top_cause.text}
            </Text>
          ) : null}
          {labour.labour_pct === null && labour.pct_note ? (
            <Text type="supporting" color="secondary">
              {labour.pct_note}
            </Text>
          ) : null}
          <VStack gap={1} hAlign="stretch">
            <Text type="body">
              Prime cost:{" "}
              {prime.prime_cents === null
                ? "not available"
                : `${formatMoney(prime.prime_cents)}${prime.prime_pct === null ? "" : `, ${prime.prime_pct}% of sales`} (target ${prime.target_pct}%, ${targetWords(prime.vs_target)})`}
            </Text>
            {prime.over_target_cents !== null ? (
              <Text type="supporting" color="secondary">
                {formatMoney(prime.over_target_cents)} above the target.
              </Text>
            ) : null}
            {prime.note ? (
              <Text type="supporting" color="secondary">
                {prime.note}
              </Text>
            ) : null}
          </VStack>
        </VStack>
      </Card>

      {summary.completeness.length > 0 ? (
        <Card padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={3}>What is missing from these figures</Heading>
            {summary.completeness.map((line) => (
              <Text key={line} type="body">
                {line}
              </Text>
            ))}
          </VStack>
        </Card>
      ) : null}

      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <Heading level={3}>Needs your attention</Heading>
          {summary.attention.length === 0 ? (
            <Text type="supporting" color="secondary">
              Nothing needs your attention for this day.
            </Text>
          ) : (
            summary.attention.map((a) => (
              <Text key={a.key} type="body">
                {links[a.key] ? (
                  <Link href={links[a.key]}>{a.label}</Link>
                ) : (
                  a.label
                )}{" "}
                ({a.count}): {a.text}
              </Text>
            ))
          )}
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <Heading level={3}>
            Open findings ({summary.open_findings.count})
          </Heading>
          {summary.open_findings.items.length === 0 ? (
            <Text type="supporting" color="secondary">
              No open findings.
            </Text>
          ) : (
            summary.open_findings.items.map((f) => (
              <Text key={f.id} type="body">
                <Link href={`/venues/${venueId}/findings/${f.id}`}>
                  {f.text}
                </Link>
              </Text>
            ))
          )}
        </VStack>
      </Card>
    </VStack>
  );
}
