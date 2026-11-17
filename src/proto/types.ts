/**
 * Prototype contracts. Everything here is SYNTHETIC. Fields marked PROPOSED do not exist in the current backend
 * responses; they are design proposals recorded in docs fixture-contracts.md. Capabilities describe what a fixture
 * persona may see in the prototype; they never imply real server authorisation.
 */

export type PersonaId =
  | "owner"
  | "partner"
  | "manager-money"
  | "manager"
  | "staff"
  | "bookkeeper"
  | "multi";

export type Capability =
  | "venue.home.owner"
  | "ops.manage"
  | "roster.edit"
  | "money.overview" // P&L / weekly financials
  | "money.dockets.review"
  | "money.dockets.read"
  | "money.labour.aggregate"
  | "cash.record" // alone must NOT expose money.overview
  | "docket.upload"
  | "announcements.compose"
  | "staff.today";

export interface Persona {
  id: PersonaId;
  label: string;
  /** Demo role label only; access is derived from `capabilities`. */
  roleLabel: string;
  capabilities: Capability[];
  /** Venues this persona belongs to. */
  venueIds: string[];
  /** Eligible for a Staff/Manager mode switch. */
  modes: ("staff" | "management")[];
  /** Stable recipient id for Inbox items. */
  recipientId: string;
}

export interface Venue {
  id: string;
  name: string;
  /** IANA timezone. */
  timezone: string;
  empty?: boolean;
}

export type Scenario =
  | "default"
  | "busy"
  | "loading"
  | "empty"
  | "error"
  | "stale"
  | "denied"
  | "partial"
  | "slow";

/** PROPOSED list envelope: items/total/limit/offset (+ lowerBound when only a floor is known). */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  /** True when `total` is only a lower bound ("at least"). */
  totalIsLowerBound?: boolean;
}

/** PROPOSED: coverage/as-of on every summary. Missing is distinct from zero: `value: null` means missing. */
export interface Coverage {
  state: "complete" | "partial" | "missing";
  asOf: string; // ISO, venue timezone offset
  periodLabel: string; // e.g. "Trading week 9-15 Nov"
  note?: string;
}
export interface Metric {
  key: string;
  label: string;
  /** Integer cents for money; counts otherwise. null = missing (NOT zero). */
  value: number | null;
  unit: "cents" | "count" | "hours" | "percent";
  coverage: Coverage;
  /** Drill-down target path relative to the persona base, with the matching filter. */
  href: string;
}

export type SectionResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }
  | { status: "denied"; message: string }
  | { status: "loading" };

// ---------- Inbox ----------
export type InboxTab = "action" | "updates" | "announcements";

export type SubjectState = "open" | "resolved" | "removed" | "revoked";

export interface InboxItem {
  /** Stable per recipient+subject. */
  id: string;
  recipientId: string;
  subjectId: string;
  tab: InboxTab;
  title: string;
  body: string;
  createdAt: string;
  group?: string; // grouping label, e.g. date bucket or issue key
  read: boolean;
  /** Announcements only: explicit acknowledgement, independent of read. */
  requiresAck?: boolean;
  acknowledged?: boolean;
  /** Action items only. */
  subjectState: SubjectState;
  /** Set when another actor resolved it; replaces the action. */
  outcome?: { text: string; at: string; by: string };
  venueId: string;
}

// ---------- Roster ----------
export interface ShiftRecord {
  id: string;
  venueId: string;
  staffId: string | null; // null = open shift
  /** Local venue wall-clock ISO without offset, e.g. 2026-11-17T22:00 */
  start: string;
  end: string; // may be on the next calendar day (overnight)
  role: string;
  leave?: boolean;
  /** Published snapshot differs from draft. */
  changed?: "added" | "edited" | "removed";
}
export interface StaffMember {
  id: string;
  name: string;
  role: string;
}
export interface RosterDraft {
  venueId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  version: number;
  shifts: ShiftRecord[];
  published: ShiftRecord[];
}
export type PublishIssue = {
  id: string;
  severity: "blocking" | "advisory";
  shiftId: string;
  message: string;
};

// ---------- Dockets ----------
export type DocketStatus = "new" | "needs_review" | "approved" | "rejected";
export interface Docket {
  id: string;
  venueId: string;
  supplier: string;
  date: string; // YYYY-MM-DD
  status: DocketStatus;
  totalCents: number | null;
  imageLabel: string;
  uploadedBy: string;
}
export interface DocketQuery {
  q?: string;
  supplier?: string;
  status?: DocketStatus;
  from?: string;
  to?: string;
  sort?: "date_desc" | "date_asc" | "supplier_asc" | "total_desc";
  limit: number;
  offset: number;
}

// ---------- Staff Today ----------
export interface TodayShift {
  id: string;
  start: string;
  end: string;
  role: string;
  state: "upcoming" | "in_progress" | "missing_clock_out" | "done";
  overnight?: boolean;
}
