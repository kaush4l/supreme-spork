import type { Docket, DocketStatus } from "../types";
import { mulberry32, pick, randInt } from "./prng";
import { addDays } from "./time";

export const DOCKET_COUNTS = [0, 1, 24, 25, 26, 75, 120] as const;

export const suppliers = [
  "Harbour Fresh Produce",
  "Sydney Fish Market Co",
  "Alpine Dairy Supplies",
  "Bluegum Beverages",
  "Corner Bakehouse",
  "Ironbark Butchers",
  "Pacific Dry Goods",
  "Wattle & Co Cleaning",
];
const statuses: DocketStatus[] = [
  "new",
  "needs_review",
  "approved",
  "rejected",
];
const uploaders = ["Sam Staff", "Mia Manager", "Max Manager", "Morgan Multi"];

/**
 * Deterministic dockets. Ids D-0001..D-NNNN. Dates descend with id (D-0001 is newest) so that under the default
 * sort (date_desc, tie-break id) higher-numbered records sit on later pages: D-0111 is on page 5 at limit 25 when
 * count >= 111.
 */
export function allDockets(venueId: string, count: number): Docket[] {
  const rng = mulberry32(
    venueId.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7),
  );
  const out: Docket[] = [];
  for (let i = 1; i <= count; i++) {
    const id = `D-${String(i).padStart(4, "0")}`;
    const known = id === "D-0111";
    out.push({
      id,
      venueId,
      supplier: known ? "Zephyr Specialty Imports" : pick(rng, suppliers),
      date: addDays("2026-11-16", -Math.floor((i - 1) / 2)),
      status: known ? "needs_review" : pick(rng, statuses),
      totalCents: i % 17 === 0 ? null : randInt(rng, 1200, 480_000),
      imageLabel: `Synthetic docket image ${id}`,
      uploadedBy: pick(rng, uploaders),
    });
  }
  return out;
}

export const KNOWN_DOCKET_ID = "D-0111";
