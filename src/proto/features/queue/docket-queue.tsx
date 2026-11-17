"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Selector } from "@astryxdesign/core/Selector";
import { Table } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ComponentProps,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { queryDockets } from "../../adapter";
import { Section } from "../../components/section";
import { DOCKET_COUNTS, suppliers } from "../../fixtures/dockets";
import { formatDate } from "../../fixtures/time";
import { useScenarioReady } from "../../state/store";
import type { Docket, PersonaId } from "../../types";
import {
  activeFilterCount,
  applyChange,
  formatCents,
  pageFromOffset,
  parseQueueParams,
  type QueueQuery,
  rangeLabel,
  restorableContext,
  SORT_LABEL,
  SORTS,
  STATUS_LABEL,
  STATUSES,
  serializeQueueParams,
  toDocketQuery,
} from "./queue-state";
import { useAccess } from "./use-access";
import { useDocketData } from "./use-docket-data";

type IsoDate = ComponentProps<typeof DateInput>["value"];
const ALL = "all";
const SUPPLIER_OPTIONS = [
  { value: ALL, label: "All suppliers" },
  ...[...suppliers, "Zephyr Specialty Imports"].map((s) => ({
    value: s,
    label: s,
  })),
];
const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];
const SORT_OPTIONS = SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }));
const COUNT_OPTIONS = DOCKET_COUNTS.map((c) => ({
  value: String(c),
  label: `${c} dockets`,
}));

interface Row extends Record<string, unknown> {
  id: string;
  supplier: string;
  date: string;
  status: string;
  total: string;
  uploadedBy: string;
}

function FilterControls({
  q,
  onChange,
}: {
  q: QueueQuery;
  onChange: (p: Partial<QueueQuery>) => void;
}) {
  return (
    <>
      <Selector
        label="Supplier"
        options={SUPPLIER_OPTIONS}
        value={q.supplier || ALL}
        onChange={(v) => onChange({ supplier: v === ALL ? "" : v })}
        presentation="adaptive"
        hasSearch
      />
      <Selector
        label="Status"
        options={STATUS_OPTIONS}
        value={q.status || ALL}
        onChange={(v) =>
          onChange({ status: v === ALL ? "" : (v as QueueQuery["status"]) })
        }
        presentation="adaptive"
      />
      <DateInput
        label="From date"
        value={(q.from || undefined) as IsoDate}
        onChange={(v) => onChange({ from: v ?? "" })}
        hasClear
      />
      <DateInput
        label="To date"
        value={(q.to || undefined) as IsoDate}
        onChange={(v) => onChange({ to: v ?? "" })}
        hasClear
      />
    </>
  );
}

export function DocketQueue({ personaId }: { personaId: PersonaId }) {
  const access = useAccess(personaId);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const data = useDocketData();
  const scenarioReady = useScenarioReady();
  const [mounted, setMounted] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adjusted, setAdjusted] = useState<number | null>(null);
  const filtersBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const q = useMemo(() => parseQueueParams(sp), [sp]);
  const qs = serializeQueueParams(q);
  const qsRef = useRef(qs);
  qsRef.current = qs;
  const ctxRef = useRef(data.ctx);
  ctxRef.current = data.ctx;

  const update = useCallback(
    (patch: Partial<QueueQuery>) => {
      setAdjusted(null);
      const next = serializeQueueParams(applyChange(q, patch));
      router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
    },
    [q, router, pathname],
  );

  // Search box: local text, committed to the URL after a short pause. Page resets via applyChange.
  const [text, setText] = useState(q.q);
  const committed = useRef(q.q);
  useEffect(() => {
    if (q.q !== committed.current) {
      committed.current = q.q;
      setText(q.q);
    }
  }, [q.q]);
  useEffect(() => {
    if (text === committed.current) return;
    const t = setTimeout(() => {
      committed.current = text;
      update({ q: text });
    }, 250);
    return () => clearTimeout(t);
  }, [text, update]);

  const result = useMemo(
    () => queryDockets(data.all, toDocketQuery(q)),
    [data.all, q],
  );
  const canRead =
    access.has("money.dockets.read") || access.has("money.dockets.review");
  const canReview = access.has("money.dockets.review");
  const ready = scenarioReady && mounted;

  // Out-of-range page: show the clamped page and say so.
  useEffect(() => {
    if (!ready || !result.clamped) return;
    const page = pageFromOffset(result.offset);
    setAdjusted(q.page);
    const next = serializeQueueParams({ ...q, page });
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  }, [ready, result.clamped, result.offset, q, router, pathname]);

  // Save scroll position (debounced) so back and refresh return to the same place.
  useEffect(() => {
    if (!ready) return;
    const write = () =>
      data.setCtx((prev) => ({
        qs: qsRef.current,
        scrollY: Math.round(window.scrollY),
        selectedId: prev.qs === qsRef.current ? prev.selectedId : null,
      }));
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(write, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", write);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", write);
    };
  }, [ready, data.setCtx]);

  // Restore scroll and the last opened row once, after the rows exist.
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current || result.clamped) return;
    const t = setTimeout(() => {
      restored.current = true;
      const r = restorableContext(ctxRef.current, qsRef.current);
      if (!r) return;
      window.scrollTo(0, r.scrollY);
      if (r.selectedId) {
        const row = document.querySelector<HTMLElement>(
          `[data-docket-link="${r.selectedId}"]`,
        );
        const target =
          row?.matches("a,button") === true
            ? row
            : row?.querySelector<HTMLElement>("a,button");
        target?.focus({ preventScroll: true });
      }
    }, 120);
    return () => clearTimeout(t);
  }, [ready, result.clamped]);

  const openDocket = (id: string) => {
    data.setCtx({
      qs: qsRef.current,
      scrollY: Math.round(window.scrollY),
      selectedId: id,
    });
  };
  const detailHref = (id: string) => `/proto/${personaId}/money/dockets/${id}`;
  const selectedId =
    ctxRef.current.qs === qs ? ctxRef.current.selectedId : null;

  if (!access.moneyRoute || !canRead) {
    return (
      <Section
        title="Dockets"
        status="denied"
        message="Your access does not include the dockets queue. Staff upload dockets from Today."
        recoveryHref={access.recoveryHref}
      />
    );
  }

  const rows: Row[] = result.items.map((d: Docket) => ({
    id: d.id,
    supplier: d.supplier,
    date: formatDate(d.date),
    status: STATUS_LABEL[d.status],
    total: formatCents(d.totalCents),
    uploadedBy: d.uploadedBy,
  }));
  const filters = activeFilterCount(q);
  const sectionStatus =
    data.scenario === "error"
      ? "error"
      : data.scenario === "denied"
        ? "denied"
        : ready
          ? "ok"
          : "loading";
  const pageNow = pageFromOffset(result.offset);

  return (
    <VStack gap={3} hAlign="stretch">
      <VStack gap={1} hAlign="start">
        <Text type="supporting">
          Review queue · all dates in the sample data · page size 25
        </Text>
        {!canReview && (
          <Text weight="semibold">
            Read-only: you can view dockets but not approve or reject them.
          </Text>
        )}
      </VStack>

      <HStack gap={2} wrap="wrap" vAlign="end">
        <TextInput
          label="Search dockets"
          description="Searches every docket by number, supplier or uploader"
          value={text}
          onChange={setText}
          hasClear
          type="search"
          width={desktop ? 360 : "100%"}
          onEnter={() => {
            committed.current = text;
            update({ q: text });
          }}
        />
        <Selector
          label="Sort by"
          options={SORT_OPTIONS}
          value={q.sort}
          onChange={(v) => update({ sort: v as QueueQuery["sort"] })}
          presentation="adaptive"
        />
        {!desktop && (
          <Button
            label={filters ? `Filters (${filters})` : "Filters"}
            variant="secondary"
            onClick={() => setSheetOpen(true)}
            ref={filtersBtnRef}
            style={{ minBlockSize: "2.75rem" }}
          />
        )}
      </HStack>
      {desktop && (
        <HStack gap={2} wrap="wrap" vAlign="end">
          <FilterControls q={q} onChange={update} />
          {(filters > 0 || q.q) && (
            <Button
              label="Clear filters and search"
              variant="ghost"
              onClick={() => {
                setText("");
                committed.current = "";
                update({ q: "", supplier: "", status: "", from: "", to: "" });
              }}
            />
          )}
        </HStack>
      )}
      <BottomSheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        label="Filter dockets"
        height="tall"
        finalFocusRef={filtersBtnRef}
      >
        <VStack gap={3} hAlign="stretch">
          <FilterControls q={q} onChange={update} />
          <Button
            label={`Show ${result.total} dockets`}
            variant="primary"
            onClick={() => setSheetOpen(false)}
            style={{ minBlockSize: "2.75rem" }}
          />
          <Button
            label="Clear filters"
            variant="ghost"
            onClick={() =>
              update({ supplier: "", status: "", from: "", to: "" })
            }
          />
        </VStack>
      </BottomSheet>

      <HStack gap={2} wrap="wrap" vAlign="end">
        <Selector
          label="Prototype control: fixture dataset size"
          options={COUNT_OPTIONS}
          value={String(data.count)}
          onChange={(v) => data.setCount(Number(v))}
          presentation="adaptive"
        />
      </HStack>

      {adjusted !== null && (
        <Banner
          status="info"
          title="Page adjusted"
          description={`Page ${adjusted} does not exist for this result, so page ${pageNow} is shown.`}
          collapsible={false}
        />
      )}
      {data.scenario === "partial" && sectionStatus === "ok" && (
        <Banner
          status="warning"
          title="Partial data"
          description="Some docket totals are missing and show as Missing, not zero."
          collapsible={false}
        />
      )}

      <Section
        title="Dockets"
        status={sectionStatus}
        message={
          data.scenario === "error"
            ? "The docket list could not be loaded (simulated). Your search and filters are kept."
            : undefined
        }
        onRetry={() => setRetry((n) => n + 1)}
        recoveryHref={access.recoveryHref}
      >
        <VStack
          gap={2}
          hAlign="stretch"
          data-retry={retry}
          onClickCapture={(e: MouseEvent<HTMLElement>) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-docket-link]",
            );
            const id = el?.getAttribute("data-docket-link");
            if (id) openDocket(id);
          }}
        >
          <Text role="status" aria-live="polite" weight="semibold">
            {rangeLabel(result.offset, result.items.length, result.total)}
            {q.q || filters ? " (filtered)" : ""}
            {` · Page ${pageNow}`}
          </Text>
          {result.total === 0 ? (
            <VStack gap={2} hAlign="start" padding={3}>
              <Text weight="semibold">
                {q.q || filters
                  ? "No dockets match your search and filters."
                  : "No dockets yet for this venue."}
              </Text>
              {(q.q || filters > 0) && (
                <Button
                  label="Clear filters and search"
                  variant="secondary"
                  onClick={() => {
                    setText("");
                    committed.current = "";
                    update({
                      q: "",
                      supplier: "",
                      status: "",
                      from: "",
                      to: "",
                    });
                  }}
                />
              )}
            </VStack>
          ) : desktop ? (
            <Table<Row>
              aria-label="Dockets"
              data={rows}
              idKey="id"
              density="balanced"
              hasHover
              rowIndexStart={result.offset + 1}
              rowCount={result.total}
              columns={[
                {
                  key: "id",
                  header: "Docket",
                  renderCell: (r) => (
                    <HStack gap={2} vAlign="center">
                      <Button
                        label={r.id}
                        href={detailHref(r.id)}
                        variant="ghost"
                        data-docket-link={r.id}
                        aria-label={`Open docket ${r.id}`}
                        onClick={() => openDocket(r.id)}
                        style={{ minBlockSize: "2.75rem" }}
                      />
                      {selectedId === r.id && (
                        <Text type="supporting">Last opened</Text>
                      )}
                    </HStack>
                  ),
                },
                { key: "supplier", header: "Supplier" },
                { key: "date", header: "Date" },
                { key: "status", header: "Status" },
                { key: "total", header: "Total", align: "end" },
                { key: "uploadedBy", header: "Uploaded by" },
              ]}
            />
          ) : (
            <List hasDividers aria-label="Dockets">
              {result.items.map((d) => (
                <ListItem
                  key={d.id}
                  label={`${d.id} · ${d.supplier}`}
                  description={`${formatDate(d.date)} · ${STATUS_LABEL[d.status]} · ${formatCents(d.totalCents)}${selectedId === d.id ? " · Last opened" : ""}`}
                  href={detailHref(d.id)}
                  data-docket-link={d.id}
                  onClick={() => openDocket(d.id)}
                />
              ))}
            </List>
          )}
          {result.total > 25 && (
            <Pagination
              page={pageNow}
              totalItems={result.total}
              pageSize={25}
              variant={desktop ? "pages" : "compact"}
              hasFirstLast
              label="Docket pages"
              onChange={(page) => update({ page })}
            />
          )}
        </VStack>
      </Section>
    </VStack>
  );
}
