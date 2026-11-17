"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { Heading, Text } from "@astryxdesign/core/Text";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { simulateMutation } from "../../adapter";
import { DeniedPanel } from "../../components/denied-panel";
import { Section, StatusFeedback } from "../../components/section";
import {
  addDays,
  diffDays,
  formatUpdated,
  REFERENCE_DATE,
  startOfWeek,
} from "../../fixtures/time";
import { getVenue } from "../../fixtures/venues";
import { pathFor } from "../../state/nav";
import {
  registerVenueSwitchGuard,
  useProto,
  useProtoSlice,
  useScenarioDelay,
  useScenarioReady,
} from "../../state/store";
import { armTapGuard } from "../../state/tap-guard";
import type { PersonaId, PublishIssue, ShiftRecord } from "../../types";
import { useTeamAccess } from "./access";
import {
  dayParts,
  fmtDay,
  fmtDayLong,
  shiftRange,
  shiftsContinuingOnto,
  shiftsStartingOn,
  splitWall,
  weekDays,
  weekLabel,
} from "./dates";
import {
  addShift,
  canPublish,
  deleteShift,
  diffDraft,
  issuesOf,
  MARKER_LABEL,
  type Marker,
  makeDraft,
  markersFor,
  publishDraft,
  publishKey,
  restoreShift,
  type ShiftInput,
  updateShift,
  type WorkingDraft,
} from "./draft";
import { FILTER_LABEL, filterShifts, parseRosterParams } from "./params";
import { PublishReview, type PublishStatus } from "./publish-review";
import { ShiftForm } from "./shift-form";
import { staffName } from "./staff-picker";
import {
  type DraftStore,
  discardForVenue,
  EMPTY_STORE,
  getDraft,
  keepForVenue,
  putDraft,
  settleKept,
  switchGuardDecision,
  wasKept,
} from "./venue-drafts";
import { VenueSwitchDialog } from "./venue-switch-dialog";

const ADD_ID = "roster-add-shift";

interface RowCtx {
  markers: Record<string, Marker>;
  issues: Map<string, PublishIssue[]>;
  onEdit: (s: ShiftRecord, el: HTMLElement) => void;
}

function labelsFor(s: ShiftRecord, ctx: RowCtx, continuing = false): string[] {
  const out: string[] = [];
  if (!s.staffId && !s.leave) out.push("Open shift");
  if (s.leave) out.push("Leave");
  const a = splitWall(s.start);
  const b = splitWall(s.end);
  if (b.date > a.date)
    out.push(
      continuing
        ? `Overnight, started ${fmtDay(a.date)}, ends ${fmtDay(b.date)} ${shiftEndTime(s)}`
        : `Overnight, ends ${fmtDay(b.date)}`,
    );
  const m = ctx.markers[s.id];
  if (m) out.push(MARKER_LABEL[m]);
  for (const i of ctx.issues.get(s.id) ?? [])
    out.push(i.severity === "blocking" ? "Blocking error" : "Advisory");
  return out;
}
function shiftEndTime(s: ShiftRecord): string {
  return shiftRange(s).split(" to ")[1] as string;
}

function describeShift(s: ShiftRecord): string {
  return `${staffName(s.staffId)}, ${s.role}, ${fmtDay(splitWall(s.start).date)} ${shiftRange(s)}`;
}

function AgendaRow({
  s,
  ctx,
  continuing,
}: {
  s: ShiftRecord;
  ctx: RowCtx;
  continuing?: boolean;
}) {
  const labels = labelsFor(s, ctx, continuing);
  return (
    <VStack
      gap={1}
      padding={3}
      hAlign="stretch"
      as="li"
      style={{ borderBlockEnd: "1px solid var(--color-border)" }}
    >
      <HStack gap={2} justify="between" wrap="wrap" vAlign="center">
        <VStack
          gap={0.5}
          hAlign="start"
          style={{ minInlineSize: 0, flex: "1 1 12rem" }}
        >
          <Text weight="semibold">
            {continuing ? `Until ${shiftEndTime(s)}` : shiftRange(s)}
          </Text>
          <Text wordBreak="break-word">{staffName(s.staffId)}</Text>
          <Text type="supporting">{s.role}</Text>
          {labels.map((l) => (
            <Text key={l} type="supporting" weight="semibold">
              {l}
            </Text>
          ))}
        </VStack>
        <Button
          label={`Edit shift: ${describeShift(s)}`}
          style={{ minBlockSize: "2.75rem" }}
          onClick={(e) => ctx.onEdit(s, e.currentTarget as HTMLElement)}
        >
          Edit
        </Button>
      </HStack>
      {(ctx.issues.get(s.id) ?? []).map((i) => (
        <Text key={i.id} type="supporting" wordBreak="break-word">
          {`${i.severity === "blocking" ? "Blocking error" : "Advisory"}: ${i.message}`}
        </Text>
      ))}
    </VStack>
  );
}

function DayAgenda({
  days,
  idx,
  setIdx,
  shifts,
  ctx,
}: {
  days: string[];
  idx: number;
  setIdx: (i: number) => void;
  shifts: ShiftRecord[];
  ctx: RowCtx;
}) {
  const day = days[idx] as string;
  const starting = shiftsStartingOn(shifts, day);
  const continuing = shiftsContinuingOnto(shifts, day);
  return (
    <VStack gap={3} hAlign="stretch">
      <HStack gap={1} wrap="wrap" as="nav" aria-label="Day of the week">
        {days.map((d, i) => {
          const p = dayParts(d);
          const n = shiftsStartingOn(shifts, d).length;
          return (
            <Button
              key={d}
              label={`${fmtDayLong(d)}, ${n} ${n === 1 ? "shift" : "shifts"}`}
              variant={i === idx ? "primary" : "secondary"}
              aria-pressed={i === idx}
              style={{ minBlockSize: "2.75rem", minInlineSize: "2.75rem" }}
              onClick={() => setIdx(i)}
            >
              {`${p.dow} ${p.day}`}
            </Button>
          );
        })}
      </HStack>
      <Heading level={3}>{fmtDayLong(day)}</Heading>
      {starting.length === 0 && continuing.length === 0 ? (
        <Text as="p">No shifts on {fmtDay(day)}.</Text>
      ) : (
        <VStack
          gap={0}
          hAlign="stretch"
          as="ul"
          aria-label={`Shifts on ${fmtDay(day)}`}
        >
          {continuing.map((s) => (
            <AgendaRow key={`c${s.id}`} s={s} ctx={ctx} continuing />
          ))}
          {starting.map((s) => (
            <AgendaRow key={s.id} s={s} ctx={ctx} />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function WeekGrid({
  days,
  shifts,
  ctx,
}: {
  days: string[];
  shifts: ShiftRecord[];
  ctx: RowCtx;
}) {
  return (
    <HStack
      gap={2}
      isScrollable
      role="region"
      aria-label="Week grid"
      tabIndex={0}
      padding={1}
      vAlign="start"
    >
      {days.map((d) => {
        const starting = shiftsStartingOn(shifts, d);
        return (
          <VStack
            key={d}
            gap={2}
            width={184}
            hAlign="stretch"
            as="section"
            aria-label={fmtDayLong(d)}
            style={{ flex: "1 0 184px" }}
          >
            <Heading level={3}>{fmtDay(d)}</Heading>
            {starting.length === 0 && <Text type="supporting">No shifts</Text>}
            {starting.map((s) => {
              const labels = labelsFor(s, ctx);
              return (
                <VStack
                  key={s.id}
                  gap={0.5}
                  padding={2}
                  hAlign="stretch"
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-2)",
                  }}
                >
                  <Text weight="semibold">{shiftRange(s)}</Text>
                  <Text maxLines={2} wordBreak="break-word">
                    {staffName(s.staffId)}
                  </Text>
                  <Text type="supporting">{s.role}</Text>
                  {labels.map((l) => (
                    <Text
                      key={l}
                      type="supporting"
                      weight="semibold"
                      wordBreak="break-word"
                    >
                      {l}
                    </Text>
                  ))}
                  <Button
                    label={`Edit shift: ${describeShift(s)}`}
                    size="sm"
                    style={{ minBlockSize: "2.75rem" }}
                    onClick={(e) =>
                      ctx.onEdit(s, e.currentTarget as HTMLElement)
                    }
                  >
                    Edit
                  </Button>
                </VStack>
              );
            })}
          </VStack>
        );
      })}
    </HStack>
  );
}

function RosterBody() {
  const proto = useProto();
  const { venueId, scenario, setVenue } = proto;
  const venue = getVenue(venueId);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const ready = useScenarioReady();
  const delay = useScenarioDelay();
  const [store, setStore] = useProtoSlice<DraftStore>(
    "roster:drafts",
    EMPTY_STORE,
  );

  const [weekStart, setWeekStart] = useState(() => startOfWeek(REFERENCE_DATE));
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const [dayIdx, setDayIdx] = useState(() =>
    Math.max(
      0,
      Math.min(6, diffDays(startOfWeek(REFERENCE_DATE), REFERENCE_DATE)),
    ),
  );
  const [view, setView] = useState<"grid" | "agenda">("grid");

  // Drill-down query from Home (day, view, filter), applied once per distinct query string.
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spKey = sp?.toString() ?? "";
  const params = useMemo(
    () => parseRosterParams(new URLSearchParams(spKey)),
    [spKey],
  );
  const appliedKey = useRef<string | null>(null);
  useEffect(() => {
    if (appliedKey.current === spKey) return;
    appliedKey.current = spKey;
    if (params.view) setView(params.view);
    if (params.day) {
      const ws = startOfWeek(params.day);
      setWeekStart(ws);
      setDayIdx(Math.max(0, Math.min(6, diffDays(ws, params.day))));
    }
  }, [spKey, params.day, params.view]);
  const clearFilter = () => {
    const q = new URLSearchParams(spKey);
    q.delete("filter");
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  const emptyBase = !!venue.empty || scenario === "empty";
  const fresh = useMemo(
    () => makeDraft(venueId, weekStart, emptyBase),
    [venueId, weekStart, emptyBase],
  );
  const draft: WorkingDraft = getDraft(store, venueId, weekStart) ?? fresh;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const storeRef = useRef(store);
  storeRef.current = store;

  const commit = useCallback(
    (next: WorkingDraft) => setStore((prev) => putDraft(prev, next)),
    [setStore],
  );

  const diff = useMemo(() => diffDraft(draft), [draft]);
  const markers = useMemo(() => markersFor(diff), [diff]);
  const issues = useMemo(() => {
    const m = new Map<string, PublishIssue[]>();
    for (const i of issuesOf(draft))
      m.set(i.shiftId, [...(m.get(i.shiftId) ?? []), i]);
    return m;
  }, [draft]);

  // ---- editor + focus restore
  const invoker = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; shift: ShiftRecord } | null
  >(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const capture = (el?: HTMLElement | null) => {
    invoker.current =
      el ?? (document.activeElement as HTMLElement | null) ?? null;
  };
  const restoreFocus = () => {
    const el = invoker.current;
    requestAnimationFrame(() => {
      const target =
        el?.isConnected && !el.hasAttribute("aria-hidden")
          ? el
          : document.getElementById(ADD_ID);
      target?.focus();
    });
  };
  const closeEditor = () => {
    setEditing(null);
    restoreFocus();
  };
  const closeReview = () => {
    setReviewOpen(false);
    restoreFocus();
  };

  // ---- venue switch guard
  const [pendingSwitch, setPendingSwitch] = useState<{
    from: string;
    to: string;
  } | null>(null);
  useEffect(
    () =>
      registerVenueSwitchGuard((from, to) => {
        if (switchGuardDecision(storeRef.current, from, to) === "ask") {
          setPendingSwitch({ from, to });
          return "handled";
        }
        return "allow";
      }),
    [],
  );

  // ---- publish
  const seen = useRef(new Set<string>());
  const inflight = useRef(false);
  const [pub, setPub] = useState<PublishStatus>({ status: "idle" });
  const [published, setPublished] = useState<string | null>(null);
  const [staleOk, setStaleOk] = useState(false);

  const publish = async () => {
    if (inflight.current) return;
    const d = draftRef.current;
    if (!canPublish(d)) return;
    inflight.current = true;
    armTapGuard(); // swallow a double tap that would hit the bottom nav once the dialog closes
    const key = publishKey(d);
    setPub({ status: "pending" });
    setPublished(null);
    try {
      let res = simulateMutation(() => publishDraft(d), {
        scenario,
        key,
        seen: seen.current,
      });
      if (res.status === "pending") {
        await delay();
        seen.current.delete(key);
        res = simulateMutation(() => publishDraft(draftRef.current), {
          scenario: "default",
          key,
          seen: seen.current,
        });
      }
      if (res.status === "success") {
        const next = res.value;
        setStore((prev) => settleKept(putDraft(prev, next), next.venueId));
        setPub({ status: "idle" });
        setPublished(
          `Published roster for ${venue.name}, week of ${weekLabel(next.weekStart)}. Now version ${next.version}. (Simulated: nothing was sent.)`,
        );
        setReviewOpen(false);
        restoreFocus();
      } else if (res.status === "failure") {
        seen.current.delete(key); // recoverable: allow a retry
        setPub({ status: "error", message: res.message });
      }
    } finally {
      inflight.current = false;
    }
  };

  // ---- edit handlers
  const saveShift = (input: ShiftInput) => {
    if (!editing) return;
    commit(
      editing.mode === "new"
        ? addShift(draft, input)
        : updateShift(draft, editing.shift.id, input),
    );
    setEditing(null);
    restoreFocus();
  };
  const removeCurrent = () => {
    if (editing?.mode !== "edit") return;
    commit(deleteShift(draft, editing.shift.id));
    setEditing(null);
    restoreFocus();
  };

  const ctx: RowCtx = {
    markers,
    issues,
    onEdit: (s, el) => {
      capture(el);
      setEditing({ mode: "edit", shift: s });
    },
  };

  const changeCount =
    diff.added.length + diff.edited.length + diff.removed.length;
  const goWeek = (delta: number) => {
    setWeekStart((w) => addDays(w, delta * 7));
  };
  const shownShifts = filterShifts(draft.shifts, params.filter, markers);
  const showGrid = desktop && view === "grid";
  const kept = wasKept(store, venueId);
  const toName = pendingSwitch ? getVenue(pendingSwitch.to).name : "";
  const fromName = pendingSwitch
    ? getVenue(pendingSwitch.from).name
    : venue.name;

  const body = (
    <VStack gap={3} hAlign="stretch">
      <Text type="supporting" as="p">
        {`${venue.name}. Times are venue time (${venue.timezone}). Sample data.`}
      </Text>
      {kept && (
        <Banner
          status="info"
          title={`Draft kept for ${venue.name}`}
          description="You switched away with unsaved changes and chose to keep them. They are restored here, and only here."
          collapsible={false}
        />
      )}
      {scenario === "stale" && !staleOk && (
        <Banner
          status="warning"
          title="This roster may be out of date"
          description={`${formatUpdated(venue.timezone)}. Refresh to check for newer changes.`}
          collapsible={false}
          endContent={
            <Button label="Refresh" onClick={() => setStaleOk(true)} />
          }
        />
      )}
      {published && (
        <StatusFeedback
          status="success"
          message={published}
          onDismiss={() => setPublished(null)}
        />
      )}

      <HStack gap={2} wrap="wrap" vAlign="center" as="nav" aria-label="Week">
        <Button
          label="Previous week"
          style={{ minBlockSize: "2.75rem" }}
          onClick={() => goWeek(-1)}
        />
        <Text weight="semibold" aria-live="polite">
          {`Week of ${weekLabel(weekStart)}`}
        </Text>
        <Button
          label="Next week"
          style={{ minBlockSize: "2.75rem" }}
          onClick={() => goWeek(1)}
        />
        <Button
          label="This week"
          variant="ghost"
          style={{ minBlockSize: "2.75rem" }}
          onClick={() => {
            setWeekStart(startOfWeek(REFERENCE_DATE));
            setDayIdx(diffDays(startOfWeek(REFERENCE_DATE), REFERENCE_DATE));
          }}
        />
      </HStack>

      <HStack gap={2} wrap="wrap" vAlign="center">
        <Text as="p">
          {`Published version ${draft.version}. `}
          {draft.edited ? "You have unsaved changes." : "No unsaved changes."}
          {` ${changeCount} ${changeCount === 1 ? "change" : "changes"} since published.`}
        </Text>
      </HStack>
      <HStack gap={2} wrap="wrap">
        <Button
          id={ADD_ID}
          label="Add shift"
          variant="primary"
          style={{ minBlockSize: "2.75rem" }}
          onClick={(e) => {
            capture(e.currentTarget as HTMLElement);
            setEditing({ mode: "new" });
          }}
        />
        <Button
          label="Review and publish"
          style={{ minBlockSize: "2.75rem" }}
          onClick={(e) => {
            capture(e.currentTarget as HTMLElement);
            setPub({ status: "idle" });
            setReviewOpen(true);
          }}
        />
        {desktop && (
          <SegmentedControl
            label="Roster view"
            value={view}
            onChange={(v) => setView(v as "grid" | "agenda")}
          >
            <SegmentedControlItem value="grid" label="Week grid" />
            <SegmentedControlItem value="agenda" label="Agenda" />
          </SegmentedControl>
        )}
      </HStack>

      {draft.shifts.length === 0 && diff.removed.length === 0 && (
        <Banner
          status="info"
          title="No shifts this week yet"
          description={
            venue.empty
              ? `${venue.name} has no roster data yet. Add the first shift to start a draft.`
              : "Nothing is rostered for this week. Add a shift to start a draft."
          }
          collapsible={false}
        />
      )}

      {params.notices.map((n) => (
        <Banner
          key={n}
          status="warning"
          title="Link option not supported"
          description={n}
          collapsible={false}
        />
      ))}
      {params.filter && (
        <HStack gap={2} wrap="wrap" vAlign="center" aria-label="Active filter">
          <Text weight="semibold">{`Showing: ${FILTER_LABEL[params.filter]} (${shownShifts.length})`}</Text>
          <Button
            label="Clear"
            variant="secondary"
            onClick={clearFilter}
            style={{ minBlockSize: "2.75rem" }}
          />
        </HStack>
      )}

      {showGrid ? (
        <WeekGrid days={days} shifts={shownShifts} ctx={ctx} />
      ) : (
        <DayAgenda
          days={days}
          idx={dayIdx}
          setIdx={setDayIdx}
          shifts={shownShifts}
          ctx={ctx}
        />
      )}

      {diff.removed.length > 0 && (
        <VStack
          gap={2}
          hAlign="stretch"
          as="section"
          aria-label="Removed since published"
        >
          <Heading level={3}>Removed since published</Heading>
          <VStack gap={0} hAlign="stretch" as="ul">
            {diff.removed.map((s) => (
              <VStack key={s.id} gap={1} padding={3} hAlign="stretch" as="li">
                <Text weight="semibold">{MARKER_LABEL.removed}</Text>
                <Text wordBreak="break-word">{describeShift(s)}</Text>
                <Button
                  label={`Restore removed shift: ${describeShift(s)}`}
                  style={{ minBlockSize: "2.75rem" }}
                  onClick={() => commit(restoreShift(draft, s.id))}
                >
                  Restore
                </Button>
              </VStack>
            ))}
          </VStack>
        </VStack>
      )}

      <ShiftForm
        open={editing !== null}
        desktop={desktop}
        shift={editing?.mode === "edit" ? editing.shift : null}
        weekStart={weekStart}
        defaultDay={days[dayIdx] ?? weekStart}
        venueName={venue.name}
        onSave={saveShift}
        onDelete={editing?.mode === "edit" ? removeCurrent : undefined}
        onClose={closeEditor}
      />
      <PublishReview
        open={reviewOpen}
        desktop={desktop}
        draft={draft}
        publish={pub}
        onPublish={publish}
        onClose={closeReview}
      />
      <VenueSwitchDialog
        open={pendingSwitch !== null}
        fromName={fromName}
        toName={toName}
        onKeep={() => {
          if (!pendingSwitch) return;
          setStore((p) => keepForVenue(p, pendingSwitch.from));
          setVenue(pendingSwitch.to, { force: true });
          setPendingSwitch(null);
        }}
        onDiscard={() => {
          if (!pendingSwitch) return;
          setStore((p) => discardForVenue(p, pendingSwitch.from));
          setVenue(pendingSwitch.to, { force: true });
          setPendingSwitch(null);
        }}
        onStay={() => setPendingSwitch(null)}
      />
    </VStack>
  );

  return (
    <Section
      title="Roster"
      status={!ready ? "loading" : scenario === "denied" ? "denied" : "ok"}
      message="Roster is not available right now."
    >
      {body}
    </Section>
  );
}

export function RosterScreen({ personaId }: { personaId: PersonaId }) {
  const access = useTeamAccess(personaId);
  if (!access.rosterAllowed)
    return (
      <DeniedPanel
        title="Roster is not available for your access"
        message="Editing the roster needs the roster permission in this venue. Nothing was changed."
        recoveryHref={pathFor(personaId, "home")}
        recoveryLabel="Go to Home"
      />
    );
  return <RosterBody />;
}
