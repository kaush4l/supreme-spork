"use client";

import { VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import type {
  ManagerToday as ManagerData,
  OwnerHome as OwnerHomeData,
  SummaryItem,
} from "../../fixtures/home";
import { managerToday, ownerHome } from "../../fixtures/home";
import type { SectionResult } from "../../types";
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

type Issues = DataOf<ManagerData["issues"]>;

/** Ids already represented by a grouped issue, so the same issue is listed once. */
export function groupedIds(issues: Issues | null): ReadonlySet<string> {
  const s = new Set<string>();
  if (!issues) return s;
  for (const g of issues.grouped) for (const id of g.relatedIds) s.add(id);
  return s;
}

function ItemsSection({
  ctx,
  title,
  label,
  result,
  onRetry,
  hide,
  empty,
}: {
  ctx: HomeCtx;
  title: string;
  label: string;
  result: SectionResult<{ items: SummaryItem[] }>;
  onRetry: () => void;
  hide: ReadonlySet<string>;
  empty: string;
}) {
  return (
    <Sec title={title} result={result} onRetry={onRetry}>
      {(d) => {
        const shown = d.items.filter((i) => !hide.has(i.id));
        return shown.length === 0 ? (
          <EmptyNote>
            {d.items.length > 0
              ? `${empty} (${d.items.length} grouped under Issues above)`
              : empty}
          </EmptyNote>
        ) : (
          <SummaryRows ctx={ctx} label={label} items={d.items} hide={hide} />
        );
      }}
    </Sec>
  );
}

export function ManagerToday({
  ctx,
  moneyGlance,
}: {
  ctx: HomeCtx;
  moneyGlance: boolean;
}) {
  const s = useSections("manager", managerToday, null);
  const issuesRes = s.get<Issues>("issues");
  const hide = groupedIds(issuesRes.status === "ok" ? issuesRes.data : null);
  return (
    <VStack gap={5} hAlign="stretch">
      <PageTitle title="Today" sub="Trading day Tue 17 Nov" />
      <StaleBanner show={s.scenario === "stale"} />

      <Sec title="Issues" result={issuesRes} onRetry={() => s.retry("issues")}>
        {(d) =>
          d.grouped.length === 0 && d.distinctFailures.length === 0 ? (
            <EmptyNote>No open issues.</EmptyNote>
          ) : (
            <VStack gap={2} hAlign="stretch">
              <List hasDividers edge="flush">
                {d.grouped.map((g) => (
                  <ListItem
                    key={g.groupId}
                    href={hrefFor(ctx, g.href)}
                    label={<Text>{g.title}</Text>}
                    description={
                      <Text type="supporting">
                        {g.relatedIds.length} related records (shown once)
                      </Text>
                    }
                  />
                ))}
              </List>
              {d.distinctFailures.length > 0 && (
                <Text type="supporting">
                  Not merged into the issue above:{" "}
                  {d.distinctFailures.map((f) => f.label).join(", ")}.
                </Text>
              )}
            </VStack>
          )
        }
      </Sec>

      <Sec
        title="Staffing now"
        result={s.get<{ onShift: number; rostered: number; href: string }>(
          "staffingNow",
        )}
        onRetry={() => s.retry("staffingNow")}
        rows={1}
      >
        {(d) => (
          <List edge="flush">
            <ListItem
              href={hrefFor(ctx, d.href)}
              label={
                <Text weight="semibold">
                  {d.onShift} of {d.rostered} rostered staff on shift
                </Text>
              }
              description={
                <Text type="supporting">Open the roster for now</Text>
              }
            />
          </List>
        )}
      </Sec>

      <Sec
        title="Next"
        result={s.get<{ items: SummaryItem[] }>("next")}
        onRetry={() => s.retry("next")}
        rows={1}
      >
        {(d) =>
          d.items.length === 0 ? (
            <EmptyNote>Nothing starting soon.</EmptyNote>
          ) : (
            <SummaryRows ctx={ctx} label="Starting next" items={d.items} />
          )
        }
      </Sec>

      <Sec
        title="Uncovered shifts"
        result={s.get<{ items: SummaryItem[] }>("uncoveredShifts")}
        onRetry={() => s.retry("uncoveredShifts")}
      >
        {(d) =>
          d.items.length === 0 ? (
            <EmptyNote>Every shift is covered.</EmptyNote>
          ) : (
            <SummaryRows ctx={ctx} label="Open shifts" items={d.items} />
          )
        }
      </Sec>

      <ItemsSection
        ctx={ctx}
        title="Checks"
        label="Checks needing attention"
        result={s.get<{ items: SummaryItem[] }>("checks")}
        onRetry={() => s.retry("checks")}
        hide={hide}
        empty="No other failed checks."
      />
      <ItemsSection
        ctx={ctx}
        title="Exceptions"
        label="Open exceptions"
        result={s.get<{ items: SummaryItem[] }>("exceptions")}
        onRetry={() => s.retry("exceptions")}
        hide={hide}
        empty="No other exceptions."
      />
      <ItemsSection
        ctx={ctx}
        title="Pending decisions"
        label="Waiting for you"
        result={s.get<{ items: SummaryItem[] }>("pendingDecisions")}
        onRetry={() => s.retry("pendingDecisions")}
        hide={hide}
        empty="No other decisions waiting."
      />

      <VStack gap={2} hAlign="start">
        <LinkButton
          ctx={ctx}
          href="operations/checks"
          label="Open all checks and exceptions"
        />
      </VStack>

      {moneyGlance && <MoneyGlance ctx={ctx} />}
    </VStack>
  );
}

/** Compact, linked money headline for a manager with money rights. Never rendered without money.overview. */
function MoneyGlance({ ctx }: { ctx: HomeCtx }) {
  const s = useSections("manager-money", ownerHome, null);
  return (
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
  );
}
