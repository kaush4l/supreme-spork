"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CoverageBadge, Section } from "../../components/section";
import { bookkeeperHome, ownerHome } from "../../fixtures/home";
import { formatDate } from "../../fixtures/time";
import { pathFor } from "../../state/nav";
import { useProto, useScenarioReady } from "../../state/store";
import type { Metric, PersonaId } from "../../types";
import { resolveHref } from "../homes/links";
import { formatCents } from "./queue-state";
import { useAccess } from "./use-access";

function metricText(m: Metric): string {
  if (m.value === null) return "Missing";
  if (m.unit === "cents") return formatCents(m.value);
  if (m.unit === "hours") return `${m.value} h`;
  if (m.unit === "percent") return `${m.value}%`;
  return String(m.value);
}

const OVERVIEW_VIEWS = ["week", "labour", "cash", "obligations"] as const;
const LAST_WEEK = "2026-11-09";
/** Which overview row each `view` scrolls to. Revenue and cost of goods share the week view. */
const METRIC_VIEW: Record<string, string> = {
  revenue: "week",
  labour_cost: "labour",
  cash_variance: "cash",
};

/**
 * Overview rows link to routes that exist: revenue -> this overview (week view), cost of goods -> Dockets for the
 * same week, labour -> Money > Labour, cash -> this overview (cash view).
 */
function metricHref(personaId: PersonaId, venueId: string, m: Metric): string {
  if (m.key === "labour_cost")
    return `${pathFor(personaId, "money/labour")}?week=${LAST_WEEK}&venue=${venueId}`;
  const href =
    m.key === "cash_variance" ? `money/cash?week=${LAST_WEEK}` : m.href;
  return resolveHref(personaId, venueId, href);
}

export function MoneyLanding({ personaId }: { personaId: PersonaId }) {
  const a = useAccess(personaId);
  const overview = a.has("money.overview");
  const dockets = a.has("money.dockets.read") || a.has("money.dockets.review");
  const labour = a.has("money.labour.aggregate") || overview;
  if (!a.moneyRoute || !(overview || dockets || labour)) {
    return (
      <Section
        title="Money"
        status="denied"
        message={
          a.has("cash.record")
            ? "Recording cash does not include money reports."
            : undefined
        }
        recoveryHref={a.recoveryHref}
      />
    );
  }
  const base = (s: string) => pathFor(personaId, `money/${s}`);
  return (
    <VStack gap={3} hAlign="stretch">
      <Section title="Money" status="ok">
        <List hasDividers aria-label="Money sections">
          {overview && (
            <ListItem
              label="Overview"
              description="Last completed trading week finances"
              href={base("overview")}
            />
          )}
          {dockets && (
            <ListItem
              label="Dockets"
              description="Review queue for supplier dockets"
              href={base("dockets")}
            />
          )}
          {labour && (
            <ListItem
              label="Labour (aggregate)"
              description="Total hours and cost, no named staff"
              href={base("labour")}
            />
          )}
        </List>
      </Section>
    </VStack>
  );
}

export function MoneyOverview({ personaId }: { personaId: PersonaId }) {
  const a = useAccess(personaId);
  const { venueId, scenario } = useProto();
  const ready = useScenarioReady();
  const sp = useSearchParams();
  const view = sp?.get("view") ?? null;
  const weekParam = sp?.get("week") ?? null;
  const viewOk =
    view !== null && (OVERVIEW_VIEWS as readonly string[]).includes(view);
  const home = ownerHome(venueId, scenario);
  const fin = home.lastWeekFinance;
  const obligations = home.upcomingObligations;
  const finReady = ready && fin.status === "ok";
  // Scroll to and highlight the requested section once the data is on screen.
  useEffect(() => {
    if (!viewOk || !finReady) return;
    const el = document.getElementById(`overview-${view}`);
    el?.scrollIntoView({ block: "start" });
    (el as HTMLElement | null)?.focus({ preventScroll: true });
  }, [viewOk, view, finReady]);
  if (!a.moneyRoute || !a.has("money.overview")) {
    return (
      <Section
        title="Money overview"
        status="denied"
        message="Your access does not include the financial overview."
        recoveryHref={a.recoveryHref}
      />
    );
  }
  const status = !ready ? "loading" : fin.status === "ok" ? "ok" : fin.status;
  return (
    <VStack gap={3} hAlign="stretch">
      <Button label="Back to Money" href={a.moneyHref} variant="secondary" />
      <Banner
        status="info"
        title="Compatibility"
        description="Old /week deep links map to Money > Overview. This is the last completed trading week."
        collapsible={false}
      />
      {view !== null && !viewOk && (
        <Banner
          status="warning"
          title={`View "${view}" is not available`}
          description="Showing the whole overview. Available views: week, labour, cash, obligations."
          collapsible={false}
        />
      )}
      {weekParam !== null && weekParam !== LAST_WEEK && (
        <Banner
          status="warning"
          title={`Week ${weekParam} is not available`}
          description="Only the last completed trading week (9-15 Nov) is in the sample data, so that week is shown."
          collapsible={false}
        />
      )}
      {viewOk && (
        <Text
          type="supporting"
          weight="semibold"
        >{`Showing: ${view} section, week of 9 Nov`}</Text>
      )}
      <Section
        title="Money overview"
        status={status}
        message={
          fin.status === "ok"
            ? undefined
            : (fin as { message?: string }).message
        }
        recoveryHref={a.moneyHref}
      >
        {fin.status === "ok" && (
          <VStack gap={2} hAlign="stretch">
            <CoverageBadge coverage={fin.data.coverage} />
            <List hasDividers aria-label="Last completed trading week">
              {fin.data.metrics.map((m) => (
                <VStack
                  key={m.key}
                  hAlign="stretch"
                  id={
                    METRIC_VIEW[m.key]
                      ? `overview-${METRIC_VIEW[m.key]}`
                      : undefined
                  }
                  tabIndex={-1}
                  style={
                    viewOk && METRIC_VIEW[m.key] === view
                      ? { outline: "2px solid currentColor" }
                      : undefined
                  }
                >
                  <ListItem
                    label={m.label}
                    description={`${m.coverage.periodLabel} · ${m.coverage.state}`}
                    endContent={<Text weight="semibold">{metricText(m)}</Text>}
                    href={metricHref(personaId, venueId, m)}
                  />
                </VStack>
              ))}
            </List>
          </VStack>
        )}
      </Section>
      {finReady && (
        <VStack
          gap={2}
          hAlign="stretch"
          id="overview-obligations"
          tabIndex={-1}
          style={
            viewOk && view === "obligations"
              ? { outline: "2px solid currentColor" }
              : undefined
          }
        >
          <Section
            title="Upcoming obligations"
            status={obligations.status === "ok" ? "ok" : obligations.status}
            level={3}
          >
            {obligations.status === "ok" && (
              <List hasDividers aria-label="Upcoming obligations">
                {obligations.data.items.map((o) => (
                  <ListItem
                    key={o.id}
                    id={o.id}
                    label={o.label}
                    description={`Due ${formatDate(o.dueDate)}`}
                    endContent={
                      <Text weight="semibold">
                        {formatCents(o.amountCents)}
                      </Text>
                    }
                  />
                ))}
              </List>
            )}
          </Section>
        </VStack>
      )}
    </VStack>
  );
}

export function LabourAggregate({ personaId }: { personaId: PersonaId }) {
  const a = useAccess(personaId);
  const { venueId, scenario } = useProto();
  const ready = useScenarioReady();
  if (
    !a.moneyRoute ||
    !(a.has("money.labour.aggregate") || a.has("money.overview"))
  ) {
    return (
      <Section
        title="Labour (aggregate)"
        status="denied"
        message="Your access does not include labour totals."
        recoveryHref={a.recoveryHref}
      />
    );
  }
  const lab = bookkeeperHome(venueId, scenario).labourAggregate;
  const status = !ready ? "loading" : lab.status === "ok" ? "ok" : lab.status;
  return (
    <VStack gap={3} hAlign="stretch">
      <Button label="Back to Money" href={a.moneyHref} variant="secondary" />
      <Section
        title="Labour (aggregate)"
        status={status}
        message={
          lab.status === "ok"
            ? undefined
            : (lab as { message?: string }).message
        }
        recoveryHref={a.moneyHref}
      >
        {lab.status === "ok" && (
          <VStack gap={2} hAlign="stretch">
            <Text type="supporting">{lab.data.periodLabel}</Text>
            <List hasDividers aria-label="Labour totals">
              <ListItem
                label="Total hours"
                endContent={
                  <Text weight="semibold">{lab.data.totalHours} h</Text>
                }
              />
              <ListItem
                label="Total labour cost"
                endContent={
                  <Text weight="semibold">
                    {formatCents(lab.data.totalCents)}
                  </Text>
                }
              />
            </List>
            <Text type="supporting">
              Aggregate totals for the venue. Named staff and individual pay
              details are not shown in this view.
            </Text>
          </VStack>
        )}
      </Section>
    </VStack>
  );
}
