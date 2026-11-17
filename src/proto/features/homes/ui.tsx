"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import type { ReactNode } from "react";
import { CoverageBadge, Section } from "../../components/section";
import type { SummaryItem } from "../../fixtures/home";
import type { Mode } from "../../state/nav";
import type { Metric, PersonaId, SectionResult } from "../../types";
import { formatMetricValue } from "./format";
import { linkAllowed, resolveHref } from "./links";

/** The data type inside an ok SectionResult. */
export type DataOf<R> = R extends { status: "ok"; data: infer D } ? D : never;

export interface HomeCtx {
  personaId: PersonaId;
  venueId: string;
  mode: Mode;
}

/** Resolves a fixture href to a prototype route, or null when the persona may not open it. */
export function hrefFor(ctx: HomeCtx, href: string): string | undefined {
  const r = resolveHref(ctx.personaId, ctx.venueId, href);
  return linkAllowed(ctx.personaId, ctx.mode, r) ? r : undefined;
}

/** One independently failing section. `children` receives the data only when it loaded. */
export function Sec<T>({
  title,
  result,
  onRetry,
  rows,
  children,
}: {
  title: string;
  result: SectionResult<T>;
  onRetry: () => void;
  rows?: number;
  children: (data: T) => ReactNode;
}) {
  return (
    <Section
      title={title}
      status={result.status}
      message={"message" in result ? result.message : undefined}
      onRetry={onRetry}
      skeletonRows={rows}
    >
      {result.status === "ok" ? children(result.data) : null}
    </Section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <Text type="supporting">{children}</Text>;
}

/** Rows that each open the matching filtered list. Plain text rows when the persona may not open the target. */
export function SummaryRows({
  ctx,
  label,
  items,
  hide,
}: {
  ctx: HomeCtx;
  label: string;
  items: SummaryItem[];
  hide?: ReadonlySet<string>;
}) {
  const shown = hide ? items.filter((i) => !hide.has(i.id)) : items;
  return (
    <List
      hasDividers
      edge="flush"
      header={<Text type="supporting">{label}</Text>}
    >
      {shown.map((i) => (
        <ListItem
          key={i.id}
          href={hrefFor(ctx, i.href)}
          label={<Text>{i.label}</Text>}
          description={
            i.detail ? <Text type="supporting">{i.detail}</Text> : undefined
          }
        />
      ))}
    </List>
  );
}

/** Metric rows: value, own period label via the section coverage, drill-down to the matching list. */
export function MetricRows({
  ctx,
  label,
  metrics,
}: {
  ctx: HomeCtx;
  label: string;
  metrics: Metric[];
}) {
  return (
    <List
      hasDividers
      edge="flush"
      header={<Text type="supporting">{label}</Text>}
    >
      {metrics.map((m) => (
        <ListItem
          key={m.key}
          href={hrefFor(ctx, m.href)}
          label={<Text>{m.label}</Text>}
          description={
            m.value === null ? (
              <Text type="supporting">
                Missing: {m.coverage.note ?? "not reported for this period"}
              </Text>
            ) : (
              <Text type="supporting">{m.coverage.periodLabel}</Text>
            )
          }
          endContent={
            <Text weight="semibold" data-testid={`metric-${m.key}`}>
              {formatMetricValue(m)}
            </Text>
          }
        />
      ))}
    </List>
  );
}

export function Cov({ metrics }: { metrics: Metric[] }) {
  const c = metrics[0]?.coverage;
  return c ? <CoverageBadge coverage={c} /> : null;
}

export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Banner
      status="warning"
      title="Some figures are out of date"
      description="The sample data was last refreshed on an earlier day. Check the as-of time on each section before relying on it."
      collapsible={false}
    />
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <VStack gap={0} hAlign="start">
      <Text type="large" weight="semibold" as="p">
        {title}
      </Text>
      {sub ? <Text type="supporting">{sub}</Text> : null}
    </VStack>
  );
}

export function LinkButton({
  ctx,
  href,
  label,
  variant = "secondary",
}: {
  ctx: HomeCtx;
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const h = hrefFor(ctx, href);
  if (!h) return null;
  return (
    <Button
      label={label}
      href={h}
      variant={variant}
      style={{ minBlockSize: "2.75rem" }}
    />
  );
}
