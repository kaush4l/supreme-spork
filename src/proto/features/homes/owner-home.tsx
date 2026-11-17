"use client";

import { VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import type { OwnerHome as OwnerHomeData } from "../../fixtures/home";
import { ownerHome } from "../../fixtures/home";
import { formatCents } from "./format";
import {
  Cov,
  type DataOf,
  EmptyNote,
  type HomeCtx,
  hrefFor,
  LinkButton,
  MetricRows,
  PageTitle,
  Sec,
  StaleBanner,
  SummaryRows,
} from "./ui";
import { useSections } from "./use-sections";

type U = DataOf<OwnerHomeData["urgent"]>;

export function urgentHeadline(u: U): string {
  const n = u.totalCount;
  if (n === 0) return "Nothing needs attention";
  return u.totalIsLowerBound
    ? `At least ${n} items need attention`
    : `${n} ${n === 1 ? "item needs" : "items need"} attention`;
}

export function viewAllLabel(u: U): string {
  return u.totalIsLowerBound
    ? `View all (at least ${u.totalCount})`
    : `View all ${u.totalCount}`;
}

export function OwnerHome({ ctx }: { ctx: HomeCtx }) {
  const s = useSections("owner", ownerHome, null);
  return (
    <VStack gap={5} hAlign="stretch">
      <PageTitle title="Home" sub="Venue overview" />
      <StaleBanner show={s.scenario === "stale"} />

      <Sec
        title="Needs attention"
        result={s.get<U>("urgent")}
        onRetry={() => s.retry("urgent")}
      >
        {(u) => (
          <VStack gap={2} hAlign="stretch">
            <Text weight="semibold" data-testid="urgent-count">
              {urgentHeadline(u)}
            </Text>
            {u.totalCount === 0 ? (
              <EmptyNote>All clear for this venue.</EmptyNote>
            ) : (
              <>
                <SummaryRows
                  ctx={ctx}
                  label={`Showing ${u.preview.length} of ${u.totalIsLowerBound ? "at least " : ""}${u.totalCount}`}
                  items={u.preview}
                />
                <LinkButton
                  ctx={ctx}
                  href={u.href}
                  label={viewAllLabel(u)}
                  variant="primary"
                />
              </>
            )}
          </VStack>
        )}
      </Sec>

      <Sec
        title="Today"
        result={s.get<DataOf<OwnerHomeData["todaySummary"]>>("todaySummary")}
        onRetry={() => s.retry("todaySummary")}
      >
        {(d) => (
          <VStack gap={1} hAlign="stretch">
            <Text type="supporting">{d.periodLabel}</Text>
            <MetricRows
              ctx={ctx}
              label="Operations today"
              metrics={d.metrics}
            />
            <Cov metrics={d.metrics} />
          </VStack>
        )}
      </Sec>

      <Sec
        title="Last completed trading week"
        result={s.get<DataOf<OwnerHomeData["lastWeekFinance"]>>(
          "lastWeekFinance",
        )}
        onRetry={() => s.retry("lastWeekFinance")}
        rows={4}
      >
        {(d) => (
          <VStack gap={1} hAlign="stretch">
            <Text type="supporting">{d.coverage.periodLabel}</Text>
            <MetricRows ctx={ctx} label="Weekly finances" metrics={d.metrics} />
            <Cov metrics={d.metrics} />
            <LinkButton
              ctx={ctx}
              href="money/weekly?week=2026-11-09"
              label="Open weekly finances"
            />
          </VStack>
        )}
      </Sec>

      <Sec
        title="Upcoming obligations"
        result={s.get<DataOf<OwnerHomeData["upcomingObligations"]>>(
          "upcomingObligations",
        )}
        onRetry={() => s.retry("upcomingObligations")}
      >
        {(d) =>
          d.items.length === 0 ? (
            <EmptyNote>No obligations due soon.</EmptyNote>
          ) : (
            <List hasDividers edge="flush">
              {d.items.map((o) => (
                <ListItem
                  key={o.id}
                  href={hrefFor(ctx, o.href)}
                  label={<Text>{o.label}</Text>}
                  description={<Text type="supporting">Due {o.dueDate}</Text>}
                  endContent={
                    <Text weight="semibold">{formatCents(o.amountCents)}</Text>
                  }
                />
              ))}
            </List>
          )
        }
      </Sec>
    </VStack>
  );
}
