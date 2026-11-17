"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { useSearchParams } from "next/navigation";
import { personas } from "../../fixtures/personas";
import { venues } from "../../fixtures/venues";
import { pathFor } from "../../state/nav";
import { useProto } from "../../state/store";
import type { PersonaId, Scenario } from "../../types";
import {
  filterOps,
  KINDS,
  type OpsKind,
  type OpsRecord,
  opsList,
  parseOpsFilter,
  STATUSES,
} from "./ops-data";
import { EmptyNote, PageTitle, Sec, StaleBanner } from "./ui";
import { useSections } from "./use-sections";

/** The list follows the venue in the link (arg), not the header venue. */
function opsFixture(_headerVenue: string, scenario: Scenario, venueId: string) {
  return { list: opsList(venueId, scenario) };
}

const STATUS_VARIANT = {
  failed: "error",
  due: "warning",
  open: "warning",
  passed: "success",
  resolved: "success",
} as const;

export function OperationsPage({ personaId }: { personaId: PersonaId }) {
  const sp = useSearchParams();
  const p = useProto();
  const persona = personas[personaId];
  const filter = parseOpsFilter(new URLSearchParams(sp?.toString() ?? ""));
  // The venue in the link wins over the header selector, but only for venues this persona belongs to.
  const urlVenue = sp?.get("venue");
  const venueId =
    urlVenue && persona.venueIds.includes(urlVenue) ? urlVenue : p.venueId;
  const venueName = venues.find((v) => v.id === venueId)?.name ?? venueId;
  const s = useSections("ops", opsFixture, venueId);
  const base = pathFor(personaId, "operations");
  const href = (next: { kind?: string; status?: string }) => {
    const q = new URLSearchParams();
    const kind = "kind" in next ? next.kind : filter.kind;
    const status = "status" in next ? next.status : filter.status;
    if (kind) q.set("kind", kind);
    if (status) q.set("status", status);
    q.set("venue", venueId);
    return `${base}?${q.toString()}`;
  };
  const result = s.get<{ rows: OpsRecord[] }>("list");
  const urlScoped = venueId !== p.venueId;

  return (
    <VStack gap={5} hAlign="stretch">
      <PageTitle
        title="Operations"
        sub={`Checks, exceptions and issues · ${venueName}`}
      />
      <StaleBanner show={s.scenario === "stale"} />

      <VStack gap={2} hAlign="stretch" as="section" aria-label="Filters">
        <Text type="supporting">Type</Text>
        <HStack gap={1} wrap="wrap">
          <Button
            label="All"
            href={href({ kind: undefined })}
            variant={filter.kind ? "secondary" : "primary"}
            aria-current={filter.kind ? undefined : "true"}
            style={{ minBlockSize: "2.75rem" }}
          />
          {KINDS.map((k) => (
            <Button
              key={k.value}
              label={k.label}
              href={href({ kind: k.value })}
              variant={filter.kind === k.value ? "primary" : "secondary"}
              aria-current={filter.kind === k.value ? "true" : undefined}
              style={{ minBlockSize: "2.75rem" }}
            />
          ))}
        </HStack>
        <Text type="supporting">Status</Text>
        <HStack gap={1} wrap="wrap">
          <Button
            label="Any status"
            href={href({ status: undefined })}
            variant={filter.status ? "secondary" : "primary"}
            aria-current={filter.status ? undefined : "true"}
            style={{ minBlockSize: "2.75rem" }}
          />
          {STATUSES.map((st) => (
            <Button
              key={st.value}
              label={st.label}
              href={href({ status: st.value })}
              variant={filter.status === st.value ? "primary" : "secondary"}
              aria-current={filter.status === st.value ? "true" : undefined}
              style={{ minBlockSize: "2.75rem" }}
            />
          ))}
        </HStack>
        {urlScoped && (
          <Text type="supporting">
            Showing {venueName} from the link you followed. Change the venue in
            the header to follow the venue selector again.
          </Text>
        )}
      </VStack>

      <Sec title="Records" result={result} onRetry={() => s.retry("list")}>
        {(d) => {
          const all = d.rows;
          const rows = filterOps(all, filter);
          if (rows.length === 0)
            return (
              <VStack gap={2} hAlign="start">
                <EmptyNote>
                  {all.length === 0
                    ? "No checks or exceptions for this venue yet."
                    : "No records match these filters."}
                </EmptyNote>
                {(filter.kind || filter.status || filter.id) && (
                  <Button
                    label="Clear filters"
                    href={`${base}?venue=${venueId}`}
                    style={{ minBlockSize: "2.75rem" }}
                  />
                )}
              </VStack>
            );
          return (
            <VStack gap={2} hAlign="stretch">
              <Text type="supporting" data-testid="ops-count">
                {rows.length} {rows.length === 1 ? "record" : "records"}
                {filter.id ? ` (record ${filter.id})` : ""}
              </Text>
              <List hasDividers edge="flush">
                {rows.map((r) => (
                  <ListItem
                    key={r.id}
                    label={<Text>{r.title}</Text>}
                    description={
                      <Text type="supporting">
                        {r.detail}
                        {r.relatedIds
                          ? ` · ${r.relatedIds.length} related records`
                          : ""}
                      </Text>
                    }
                    endContent={
                      <Badge
                        label={r.status}
                        variant={STATUS_VARIANT[r.status]}
                      />
                    }
                  />
                ))}
              </List>
              {filter.id && (
                <Button
                  label="Show all records"
                  href={`${base}?venue=${venueId}`}
                  style={{ minBlockSize: "2.75rem" }}
                />
              )}
            </VStack>
          );
        }}
      </Sec>
    </VStack>
  );
}

export type { OpsKind };
