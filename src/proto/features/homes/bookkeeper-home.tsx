"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { useRef, useState } from "react";
import { simulateMutation } from "../../adapter";
import type { FeedbackStatus } from "../../components/section";
import { CoverageBadge, StatusFeedback } from "../../components/section";
import {
  type BookkeeperHome as BkData,
  bookkeeperHome,
} from "../../fixtures/home";
import { useProto, useScenarioDelay } from "../../state/store";
import { formatCents } from "./format";
import {
  type DataOf,
  EmptyNote,
  type HomeCtx,
  hrefFor,
  LinkButton,
  PageTitle,
  Sec,
  StaleBanner,
} from "./ui";
import { useSections } from "./use-sections";

function ExportRow({
  id,
  label,
  available,
}: {
  id: string;
  label: string;
  available: boolean;
}) {
  const { scenario } = useProto();
  const delay = useScenarioDelay();
  const seen = useRef(new Set<string>());
  const attempt = useRef(0);
  const busy = useRef(false);
  const [fb, setFb] = useState<{ status: FeedbackStatus; message?: string }>({
    status: "idle",
  });
  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setFb({ status: "pending", message: `Preparing ${label}` });
    const key = `${id}#${attempt.current}`;
    const r = simulateMutation(() => true, {
      scenario,
      key,
      seen: seen.current,
    });
    await new Promise((res) => setTimeout(res, 500));
    if (r.status === "pending") await delay();
    if (r.status === "failure") {
      attempt.current += 1;
      setFb({ status: "error", message: r.message });
    } else if (r.status !== "duplicate") {
      setFb({
        status: "success",
        message: `${label} is ready (simulated, no file was created).`,
      });
    }
    busy.current = false;
  };
  return (
    <VStack gap={1} hAlign="stretch">
      <HStack gap={2} wrap="wrap" vAlign="center" justify="between">
        <VStack gap={0} hAlign="start">
          <Text>{label}</Text>
          <Text type="supporting">
            {available
              ? "Available"
              : "Not available: no data for this venue yet"}
          </Text>
        </VStack>
        <Button
          label={`Prepare export: ${label}`}
          isDisabled={!available}
          isLoading={fb.status === "pending"}
          onClick={run}
          style={{ minBlockSize: "2.75rem" }}
        />
      </HStack>
      <StatusFeedback
        status={fb.status}
        message={fb.message}
        onDismiss={() => setFb({ status: "idle" })}
      />
    </VStack>
  );
}

export function BookkeeperHome({ ctx }: { ctx: HomeCtx }) {
  const s = useSections("bookkeeper", bookkeeperHome, null);
  return (
    <VStack gap={5} hAlign="stretch">
      <PageTitle title="Home" sub="Bookkeeping overview" />
      <StaleBanner show={s.scenario === "stale"} />

      <Sec
        title="Review queues"
        result={s.get<DataOf<BkData["reviewQueues"]>>("reviewQueues")}
        onRetry={() => s.retry("reviewQueues")}
      >
        {(d) => (
          <VStack gap={2} hAlign="stretch">
            <List hasDividers edge="flush">
              {d.queues.map((q) => (
                <ListItem
                  key={q.key}
                  href={hrefFor(ctx, q.href)}
                  label={<Text>{q.label}</Text>}
                  endContent={<Badge label={String(q.count)} />}
                />
              ))}
            </List>
            <LinkButton
              ctx={ctx}
              href="dockets"
              label="Open dockets (read-only)"
              variant="primary"
            />
          </VStack>
        )}
      </Sec>

      <Sec
        title="Oldest waiting"
        result={s.get<DataOf<BkData["oldestAgeDays"]>>("oldestAgeDays")}
        onRetry={() => s.retry("oldestAgeDays")}
        rows={1}
      >
        {(d) =>
          d.days === null ? (
            <EmptyNote>Nothing is waiting for review.</EmptyNote>
          ) : (
            <List edge="flush">
              <ListItem
                href={hrefFor(ctx, d.href)}
                label={
                  <Text weight="semibold" data-testid="oldest-age">
                    {d.days} days
                  </Text>
                }
                description={
                  <Text type="supporting">
                    Oldest docket waiting for review
                  </Text>
                }
              />
            </List>
          )
        }
      </Sec>

      <Sec
        title="Data coverage"
        result={s.get<DataOf<BkData["dataCoverage"]>>("dataCoverage")}
        onRetry={() => s.retry("dataCoverage")}
        rows={2}
      >
        {(d) => (
          <VStack gap={2} hAlign="start">
            <CoverageBadge coverage={d.coverage} />
            <LinkButton
              ctx={ctx}
              href={d.href}
              label="See dockets for this period"
            />
          </VStack>
        )}
      </Sec>

      <Sec
        title="Labour evidence"
        result={s.get<DataOf<BkData["labourAggregate"]>>("labourAggregate")}
        onRetry={() => s.retry("labourAggregate")}
        rows={2}
      >
        {(d) => (
          <VStack gap={2} hAlign="stretch">
            <Text type="supporting">{d.periodLabel}</Text>
            <Text data-testid="labour-aggregate">
              {d.totalHours} hours, {formatCents(d.totalCents)} in total
            </Text>
            <Collapsible
              defaultIsOpen={false}
              trigger={<Text weight="semibold">Labour detail</Text>}
            >
              <VStack gap={1} hAlign="stretch" padding={2}>
                <Text>
                  Aggregate for the whole venue. Total hours: {d.totalHours}.
                </Text>
                <Text>Total labour cost: {formatCents(d.totalCents)}.</Text>
                <Text type="supporting">
                  Aggregate evidence only. Individual staff and their pay
                  details are not shown to your role.
                </Text>
              </VStack>
            </Collapsible>
          </VStack>
        )}
      </Sec>

      <Sec
        title="Exports"
        result={s.get<DataOf<BkData["exports"]>>("exports")}
        onRetry={() => s.retry("exports")}
      >
        {(d) => (
          <VStack gap={3} hAlign="stretch">
            {d.items.map((e) => (
              <ExportRow
                key={e.id}
                id={e.id}
                label={e.label}
                available={e.available}
              />
            ))}
          </VStack>
        )}
      </Sec>
    </VStack>
  );
}
