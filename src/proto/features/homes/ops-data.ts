import { getVenue } from "../../fixtures/venues";
import type { Scenario, SectionResult } from "../../types";
import { sectionFor } from "./sections";

export type OpsKind = "checks" | "exceptions" | "issues";
export type OpsStatus = "due" | "failed" | "passed" | "open" | "resolved";

export interface OpsRecord {
  id: string;
  kind: OpsKind;
  venueId: string;
  title: string;
  status: OpsStatus;
  detail: string;
  /** Explicit relationship ids (issues only). */
  relatedIds?: string[];
}

export const KINDS: { value: OpsKind; label: string }[] = [
  { value: "checks", label: "Checks" },
  { value: "exceptions", label: "Exceptions" },
  { value: "issues", label: "Issues" },
];
export const STATUSES: { value: OpsStatus; label: string }[] = [
  { value: "due", label: "Due" },
  { value: "failed", label: "Failed" },
  { value: "passed", label: "Passed" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

const harbour: OpsRecord[] = [
  {
    id: "c-10",
    kind: "checks",
    venueId: "v-harbour",
    title: "Opening checklist",
    status: "passed",
    detail: "Completed 6:40 am",
  },
  {
    id: "c-11",
    kind: "checks",
    venueId: "v-harbour",
    title: "Fridge 1 temperature",
    status: "passed",
    detail: "3 C at 8:00 am",
  },
  {
    id: "c-12",
    kind: "checks",
    venueId: "v-harbour",
    title: "Fridge 2 temperature check failed",
    status: "failed",
    detail: "9 C at 8:00 am, above the 5 C limit",
  },
  {
    id: "c-13",
    kind: "checks",
    venueId: "v-harbour",
    title: "Fridge 3 temperature check failed",
    status: "failed",
    detail: "8 C at 8:05 am, above the 5 C limit",
  },
  {
    id: "c-14",
    kind: "checks",
    venueId: "v-harbour",
    title: "Lunch service hygiene check",
    status: "due",
    detail: "Due 11:30 am",
  },
  {
    id: "c-15",
    kind: "checks",
    venueId: "v-harbour",
    title: "Fryer oil check",
    status: "due",
    detail: "Due 12:00 pm",
  },
  {
    id: "c-16",
    kind: "checks",
    venueId: "v-harbour",
    title: "Bar line clean",
    status: "due",
    detail: "Due 2:00 pm",
  },
  {
    id: "c-17",
    kind: "checks",
    venueId: "v-harbour",
    title: "Closing checklist",
    status: "due",
    detail: "Due 10:00 pm",
  },
  {
    id: "e-4",
    kind: "exceptions",
    venueId: "v-harbour",
    title: "Fridge 2 exception logged",
    status: "open",
    detail: "Logged by a cook at 8:10 am",
  },
  {
    id: "e-5",
    kind: "exceptions",
    venueId: "v-harbour",
    title: "Late delivery: Harbour Fresh",
    status: "resolved",
    detail: "Resolved 9:15 am",
  },
  {
    id: "issue-fridge-2",
    kind: "issues",
    venueId: "v-harbour",
    title: "Fridge 2 temperature",
    status: "open",
    detail:
      "One issue across a failed check, an exception and a pending decision",
    relatedIds: ["c-12", "e-4", "d-2"],
  },
];

const perth: OpsRecord[] = [
  {
    id: "p-c-1",
    kind: "checks",
    venueId: "v-perth",
    title: "Cellar temperature",
    status: "passed",
    detail: "11 C at 7:00 am",
  },
  {
    id: "p-c-2",
    kind: "checks",
    venueId: "v-perth",
    title: "Glass wash check",
    status: "due",
    detail: "Due 5:00 pm",
  },
  {
    id: "p-e-1",
    kind: "exceptions",
    venueId: "v-perth",
    title: "Keg line leak",
    status: "open",
    detail: "Reported 6:30 am",
  },
];

export function opsRecordsFor(venueId: string): OpsRecord[] {
  if (getVenue(venueId).empty) return [];
  return venueId === "v-perth" ? perth : harbour;
}

export interface OpsFilter {
  kind?: OpsKind;
  status?: OpsStatus;
  id?: string;
}

const KIND_SET = new Set<string>(KINDS.map((k) => k.value));
const STATUS_SET = new Set<string>(STATUSES.map((s) => s.value));

export function parseOpsFilter(sp: URLSearchParams): OpsFilter {
  const kind = sp.get("kind");
  const status = sp.get("status");
  const id = sp.get("id");
  const f: OpsFilter = {};
  if (kind && KIND_SET.has(kind)) f.kind = kind as OpsKind;
  if (status && STATUS_SET.has(status)) f.status = status as OpsStatus;
  if (id) f.id = id;
  return f;
}

export function filterOps(rows: OpsRecord[], f: OpsFilter): OpsRecord[] {
  return rows.filter(
    (r) =>
      (!f.kind || r.kind === f.kind) &&
      (!f.status || r.status === f.status) &&
      (!f.id || r.id === f.id),
  );
}

export function opsList(
  venueId: string,
  scenario: Scenario,
): SectionResult<{ rows: OpsRecord[] }> {
  return sectionFor(scenario, () => ({
    rows: scenario === "empty" ? [] : opsRecordsFor(venueId),
  }));
}
