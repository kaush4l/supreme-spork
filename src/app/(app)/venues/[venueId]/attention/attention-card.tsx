import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import type { AttentionItem } from "@/server/data/attention";
import { formatDay, formatMoney } from "@/server/format";
import { sinceLabel, whoWords } from "./words";

/** One thing that needs attention: what it is, what it touches, how long it has waited, who may act, and where to go. */
export function AttentionCard({
  item,
  tz,
  href,
}: {
  item: AttentionItem;
  tz: string;
  /** The page to open, or null when the person's navigation has none for this item. */
  href: string | null;
}) {
  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <Heading level={3}>{item.title}</Heading>
        <Text type="body">{item.text}</Text>
        {item.effect_cents !== null ? (
          <Text type="body">Money: {formatMoney(item.effect_cents)}</Text>
        ) : item.effect_note ? (
          <Text type="supporting" color="secondary">
            {item.effect_note}
          </Text>
        ) : null}
        {item.since ? (
          <Text type="supporting" color="secondary">
            {sinceLabel(item)} {formatDay(item.since, tz)}
          </Text>
        ) : null}
        <Text type="supporting" color="secondary">
          {whoWords(item.who)}
        </Text>
        {href ? <Button label="Open" variant="primary" href={href} /> : null}
      </VStack>
    </Card>
  );
}
