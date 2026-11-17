import type {
  Coverage,
  Metric,
  Scenario,
  SectionResult,
  TodayShift,
} from "../types";
import { agoIso, referenceNowFor } from "./time";
import { getVenue } from "./venues";

/** Every drill-down href is relative to the persona base path (e.g. 'dockets?status=needs_review'). */
export interface SummaryItem {
  id: string;
  label: string;
  detail?: string;
  count?: number;
  href: string;
}

function section<T>(
  scenario: Scenario,
  build: () => T,
  opts: { failsUnder?: Scenario[] } = {},
): SectionResult<T> {
  if (scenario === "loading") return { status: "loading" };
  if (scenario === "denied")
    return {
      status: "denied",
      message: "You do not have access to this section (simulated).",
    };
  if (scenario === "error" || opts.failsUnder?.includes(scenario)) {
    return {
      status: "error",
      message:
        "This section could not be loaded (simulated). Other sections are unaffected.",
    };
  }
  return { status: "ok", data: build() };
}

function cov(
  venueId: string,
  scenario: Scenario,
  periodLabel: string,
  state: Coverage["state"] = "complete",
  note?: string,
): Coverage {
  const tz = getVenue(venueId).timezone;
  const asOf =
    scenario === "stale"
      ? agoIso({ days: 3 }).replace(/T.*/, "T08:00:00+11:00")
      : referenceNowFor(tz);
  const c: Coverage = { state, asOf, periodLabel };
  if (note) c.note = note;
  else if (scenario === "stale")
    c.note = "Data is out of date (simulated stale scenario).";
  return c;
}

function metric(
  key: string,
  label: string,
  value: number | null,
  unit: Metric["unit"],
  coverage: Coverage,
  href: string,
): Metric {
  return { key, label, value, unit, coverage, href };
}

const isEmpty = (venueId: string, scenario: Scenario) =>
  scenario === "empty" || getVenue(venueId).empty === true;

// ---------------- Owner ----------------
export interface OwnerHome {
  urgent: SectionResult<{
    preview: SummaryItem[]; // at most 5
    totalCount: number;
    /** How many items were actually supplied to the client (may be fewer than totalCount). */
    suppliedCount: number;
    totalIsLowerBound?: boolean;
    href: string;
  }>;
  todaySummary: SectionResult<{ periodLabel: string; metrics: Metric[] }>;
  lastWeekFinance: SectionResult<{ coverage: Coverage; metrics: Metric[] }>;
  upcomingObligations: SectionResult<{
    items: (SummaryItem & { dueDate: string; amountCents: number })[];
  }>;
}

/**
 * Scenarios: busy => totalCount 120 with only 100 supplied (v-perth + busy => lower bound: "at least 100");
 * partial => finance has a null (missing) metric with partial coverage AND upcomingObligations errors;
 * stale => old coverage asOf; empty / empty venue => zeros (real zeros, not missing).
 */
export function ownerHome(
  venueId: string,
  scenario: Scenario = "default",
): OwnerHome {
  const empty = isEmpty(venueId, scenario);
  const week = "Trading week 9-15 Nov";
  const day = "Trading day Tue 17 Nov";
  return {
    urgent: section(scenario, () => {
      const lowerBound = scenario === "busy" && venueId === "v-perth";
      const total = empty
        ? 0
        : scenario === "busy"
          ? lowerBound
            ? 100
            : 120
          : 7;
      const supplied = empty ? 0 : scenario === "busy" ? 100 : 7;
      const preview: SummaryItem[] = Array.from(
        { length: Math.min(5, supplied) },
        (_, i) => ({
          id: `urgent-${i + 1}`,
          label: [
            "Docket needs review",
            "Unfilled shift tonight",
            "Cash variance",
            "Leave request",
            "Temperature check failed",
          ][i] as string,
          detail: `Synthetic urgent item ${i + 1}`,
          href: [
            "dockets?status=needs_review",
            "roster?filter=open",
            "money/cash?filter=variance",
            "team/leave",
            "operations/checks?status=failed",
          ][i] as string,
        }),
      );
      const out: {
        preview: SummaryItem[];
        totalCount: number;
        suppliedCount: number;
        totalIsLowerBound?: boolean;
        href: string;
      } = {
        preview,
        totalCount: total,
        suppliedCount: supplied,
        href: "attention",
      };
      if (lowerBound) out.totalIsLowerBound = true;
      return out;
    }),
    todaySummary: section(scenario, () => {
      const c = cov(venueId, scenario, day);
      return {
        periodLabel: day,
        metrics: [
          metric(
            "staff_on_shift",
            "Staff on shift now",
            empty ? 0 : 9,
            "count",
            c,
            "roster?view=now",
          ),
          metric(
            "open_shifts_today",
            "Open shifts today",
            empty ? 0 : 2,
            "count",
            c,
            "roster?filter=open&day=today",
          ),
          metric(
            "checks_due",
            "Checks due",
            empty ? 0 : 4,
            "count",
            c,
            "operations/checks?status=due",
          ),
          metric(
            "dockets_to_review",
            "Dockets to review",
            empty ? 0 : 6,
            "count",
            c,
            "dockets?status=needs_review",
          ),
        ],
      };
    }),
    lastWeekFinance: section(scenario, () => {
      const partial = scenario === "partial";
      const c = cov(
        venueId,
        scenario,
        week,
        partial ? "partial" : "complete",
        partial
          ? "Labour cost for the week is not available yet; it is missing, not zero."
          : undefined,
      );
      return {
        coverage: c,
        metrics: [
          metric(
            "revenue",
            "Revenue",
            empty ? 0 : 4_812_500,
            "cents",
            c,
            "money/weekly?week=2026-11-09",
          ),
          metric(
            "cogs",
            "Cost of goods",
            empty ? 0 : 1_402_300,
            "cents",
            c,
            "dockets?from=2026-11-09&to=2026-11-15",
          ),
          // null = missing (partial), distinct from an explicit 0.
          metric(
            "labour_cost",
            "Labour cost",
            partial ? null : empty ? 0 : 1_655_000,
            "cents",
            c,
            "money/labour?week=2026-11-09",
          ),
          metric(
            "cash_variance",
            "Cash variance",
            0,
            "cents",
            c,
            "money/cash?week=2026-11-09",
          ),
        ],
      };
    }),
    upcomingObligations: section(
      scenario,
      () => ({
        items: empty
          ? []
          : [
              {
                id: "ob-1",
                label: "BAS lodgement",
                dueDate: "2026-11-28",
                amountCents: 1_820_000,
                href: "money/obligations#ob-1",
              },
              {
                id: "ob-2",
                label: "Superannuation payment",
                dueDate: "2026-11-28",
                amountCents: 960_400,
                href: "money/obligations#ob-2",
              },
              {
                id: "ob-3",
                label: "Supplier statement: Harbour Fresh",
                dueDate: "2026-12-01",
                amountCents: 412_000,
                href: "money/obligations#ob-3",
              },
            ],
      }),
      { failsUnder: ["partial"] },
    ),
  };
}

// ---------------- Manager ----------------
export interface IssueGroup {
  groupId: string;
  title: string;
  /** Explicit relationship ids: the source records this one issue spans. */
  relatedIds: string[];
  href: string;
}
export interface ManagerToday {
  staffingNow: SectionResult<{
    onShift: number;
    rostered: number;
    href: string;
  }>;
  next: SectionResult<{ items: SummaryItem[] }>;
  uncoveredShifts: SectionResult<{ items: SummaryItem[] }>;
  checks: SectionResult<{ items: SummaryItem[] }>;
  exceptions: SectionResult<{ items: SummaryItem[] }>;
  pendingDecisions: SectionResult<{ items: SummaryItem[] }>;
  /** One grouped issue (relatedIds) plus distinct failures that must NOT be merged into it. */
  issues: SectionResult<{
    grouped: IssueGroup[];
    distinctFailures: SummaryItem[];
  }>;
}

export function managerToday(
  venueId: string,
  scenario: Scenario = "default",
): ManagerToday {
  const empty = isEmpty(venueId, scenario);
  const list = (items: SummaryItem[]) => ({ items: empty ? [] : items });
  return {
    staffingNow: section(scenario, () => ({
      onShift: empty ? 0 : 9,
      rostered: empty ? 0 : 11,
      href: "roster?view=now",
    })),
    next: section(scenario, () =>
      list([
        {
          id: "n1",
          label: "Evening crew starts 4:00 pm",
          detail: "5 staff",
          href: "roster?day=today&from=16:00",
        },
      ]),
    ),
    uncoveredShifts: section(scenario, () =>
      list([
        {
          id: "u1",
          label: "Waiter 5:00-11:00 pm",
          detail: "Open",
          href: "roster?filter=open&shift=u1",
        },
        {
          id: "u2",
          label: "Cook 11:00 am-3:00 pm Fri",
          detail: "Open",
          href: "roster?filter=open&shift=u2",
        },
      ]),
    ),
    checks: section(
      scenario,
      () =>
        list([
          {
            id: "c-12",
            label: "Fridge 2 temperature check failed",
            href: "operations/checks?id=c-12",
          },
          {
            id: "c-13",
            label: "Fridge 3 temperature check failed",
            href: "operations/checks?id=c-13",
          },
        ]),
      { failsUnder: ["partial"] },
    ),
    exceptions: section(scenario, () =>
      list([
        {
          id: "e-4",
          label: "Fridge 2 exception logged",
          href: "operations/exceptions?id=e-4",
        },
      ]),
    ),
    pendingDecisions: section(scenario, () =>
      list([
        {
          id: "d-2",
          label: "Discard stock from fridge 2?",
          href: "decisions?id=d-2",
        },
        { id: "d-3", label: "Approve swap request", href: "decisions?id=d-3" },
      ]),
    ),
    issues: section(scenario, () => ({
      grouped: empty
        ? []
        : [
            {
              groupId: "issue-fridge-2",
              title: "Fridge 2 temperature",
              relatedIds: ["c-12", "e-4", "d-2"],
              href: "operations/issues?id=issue-fridge-2",
            },
          ],
      // Fridge 3 is a different unit: kept separate even though it looks similar.
      distinctFailures: empty
        ? []
        : [
            {
              id: "c-13",
              label: "Fridge 3 temperature check failed",
              href: "operations/checks?id=c-13",
            },
          ],
    })),
  };
}

// ---------------- Staff ----------------
export type StaffDay =
  | "normal"
  | "missing_clock_out"
  | "overnight"
  | "no_work"
  | "late_finish";
export interface StaffToday {
  shifts: SectionResult<{
    currentShift: TodayShift | null;
    nextShift: TodayShift | null;
    clock: {
      state:
        | "not_started"
        | "clocked_in"
        | "missing_clock_out"
        | "clocked_out"
        | "none";
      clockedInAt?: string;
      message: string;
      action: "clock_in" | "clock_out" | "report_missing_clock_out" | "none";
    };
    /** True when the shift ran past its scheduled end. */
    lateFinish?: boolean;
    noWorkToday?: boolean;
  }>;
  dueChecklist: SectionResult<{ items: SummaryItem[] }>;
  responses: SectionResult<{ items: SummaryItem[] }>;
  docketUploadAllowed: boolean;
}

export function staffToday(
  venueId: string,
  scenario: Scenario = "default",
  day: StaffDay = "normal",
): StaffToday {
  const d = "2026-11-17";
  return {
    shifts: section(scenario, () => {
      const cur = (over: Partial<TodayShift>): TodayShift => ({
        id: `${venueId}:ts-1`,
        start: `${d}T09:00`,
        end: `${d}T17:00`,
        role: "Waiter",
        state: "in_progress",
        ...over,
      });
      const next: TodayShift = {
        id: `${venueId}:ts-2`,
        start: "2026-11-18T09:00",
        end: "2026-11-18T17:00",
        role: "Waiter",
        state: "upcoming",
      };
      switch (day) {
        case "no_work":
          return {
            currentShift: null,
            nextShift: next,
            clock: { state: "none", message: "No work today.", action: "none" },
            noWorkToday: true,
          };
        case "missing_clock_out":
          return {
            currentShift: cur({
              id: `${venueId}:ts-0`,
              start: "2026-11-16T09:00",
              end: "2026-11-16T17:00",
              state: "missing_clock_out",
            }),
            nextShift: cur({ state: "upcoming" }),
            clock: {
              state: "missing_clock_out",
              clockedInAt: "2026-11-16T09:02",
              message: "You did not clock out of yesterday's shift.",
              action: "report_missing_clock_out",
            },
          };
        case "overnight":
          return {
            currentShift: cur({
              start: `${d}T22:00`,
              end: "2026-11-18T06:00",
              overnight: true,
              state: "upcoming",
            }),
            nextShift: null,
            clock: {
              state: "not_started",
              message:
                "Overnight shift starts 10:00 pm and ends 6:00 am tomorrow.",
              action: "clock_in",
            },
          };
        case "late_finish":
          return {
            currentShift: cur({
              end: "2026-11-17T10:00",
              state: "in_progress",
            }),
            nextShift: next,
            clock: {
              state: "clocked_in",
              clockedInAt: `${d}T09:00`,
              message:
                "Your shift ended at 10:00 am. You are still clocked in.",
              action: "clock_out",
            },
            lateFinish: true,
          };
        default:
          return {
            currentShift: cur({}),
            nextShift: next,
            clock: {
              state: "clocked_in",
              clockedInAt: `${d}T09:01`,
              message: "Clocked in since 9:01 am.",
              action: "clock_out",
            },
          };
      }
    }),
    dueChecklist: section(scenario, () => ({
      items:
        scenario === "empty"
          ? []
          : [
              {
                id: "cl-1",
                label: "Opening checklist",
                detail: "Due now",
                href: "today/checklists/cl-1",
              },
              {
                id: "cl-2",
                label: "Fridge temperature log",
                detail: "Due 12:00 pm",
                href: "today/checklists/cl-2",
              },
            ],
    })),
    responses: section(
      scenario,
      () => ({
        items:
          scenario === "empty"
            ? []
            : [
                {
                  id: "r-1",
                  label: "Offer: Friday close shift",
                  detail: "Respond by 5:00 pm",
                  href: "inbox?tab=action&subject=act-003",
                },
              ],
      }),
      { failsUnder: ["partial"] },
    ),
    docketUploadAllowed: scenario !== "denied",
  };
}

// ---------------- Bookkeeper ----------------
export interface BookkeeperHome {
  reviewQueues: SectionResult<{
    queues: { key: string; label: string; count: number; href: string }[];
  }>;
  oldestAgeDays: SectionResult<{ days: number | null; href: string }>;
  dataCoverage: SectionResult<{ coverage: Coverage; href: string }>;
  exports: SectionResult<{ items: (SummaryItem & { available: boolean })[] }>;
  /** Aggregate only: hours and total cents. No named staff and no pay-rate fields. */
  labourAggregate: SectionResult<{
    periodLabel: string;
    totalHours: number;
    totalCents: number;
    href: string;
  }>;
}

export function bookkeeperHome(
  venueId: string,
  scenario: Scenario = "default",
): BookkeeperHome {
  const empty = isEmpty(venueId, scenario);
  return {
    reviewQueues: section(scenario, () => ({
      queues: [
        {
          key: "needs_review",
          label: "Needs review",
          count: empty ? 0 : scenario === "busy" ? 64 : 12,
          href: "dockets?status=needs_review",
        },
        {
          key: "new",
          label: "New",
          count: empty ? 0 : scenario === "busy" ? 31 : 5,
          href: "dockets?status=new",
        },
        {
          key: "rejected",
          label: "Rejected",
          count: empty ? 0 : 2,
          href: "dockets?status=rejected",
        },
      ],
    })),
    oldestAgeDays: section(scenario, () => ({
      days: empty ? null : scenario === "busy" ? 19 : 6,
      href: "dockets?status=needs_review&sort=date_asc",
    })),
    dataCoverage: section(scenario, () => ({
      coverage: cov(
        venueId,
        scenario,
        "Trading week 9-15 Nov",
        scenario === "partial" ? "partial" : "complete",
        scenario === "partial"
          ? "Two suppliers have not sent statements."
          : undefined,
      ),
      href: "dockets?from=2026-11-09&to=2026-11-15",
    })),
    exports: section(
      scenario,
      () => ({
        items: [
          {
            id: "ex-1",
            label: "Dockets CSV, week 9-15 Nov",
            available: !empty,
            href: "exports/dockets?week=2026-11-09",
          },
          {
            id: "ex-2",
            label: "Labour totals CSV, week 9-15 Nov",
            available: !empty,
            href: "exports/labour?week=2026-11-09",
          },
        ],
      }),
      { failsUnder: ["partial"] },
    ),
    labourAggregate: section(scenario, () => ({
      periodLabel: "Trading week 9-15 Nov",
      totalHours: empty ? 0 : 612.5,
      totalCents: empty ? 0 : 1_655_000,
      href: "money/labour?week=2026-11-09",
    })),
  };
}
