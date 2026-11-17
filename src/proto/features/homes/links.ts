import { personas } from "../../fixtures/personas";
import { type Mode, pathFor, routeAllowed } from "../../state/nav";
import type { PersonaId } from "../../types";

/**
 * Maps a fixture drill-down href (relative to the persona base, written by the home fixtures) onto the real
 * prototype route that renders the matching filtered list. The query (date, status, filter) is preserved and the
 * venue is appended so the destination shows the same scope as the summary.
 */
export function resolveHref(
  personaId: PersonaId,
  venueId: string,
  href: string,
): string {
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const qAt = noHash.indexOf("?");
  const path = qAt >= 0 ? noHash.slice(0, qAt) : noHash;
  const query = new URLSearchParams(qAt >= 0 ? noHash.slice(qAt + 1) : "");

  const out = new URLSearchParams();
  const put = (k: string, v: string) => out.set(k, v);
  let segment: string;
  let extra: Record<string, string> = {};

  if (path === "attention") {
    segment = "inbox";
    extra = { tab: "action", scope: "urgent" };
  } else if (path === "dockets") {
    segment = "money/dockets";
  } else if (path === "roster") {
    segment = "team/roster";
  } else if (path === "team/leave") {
    segment = "team/roster";
    extra = { filter: "leave" };
  } else if (path === "decisions") {
    segment = "inbox";
    extra = { tab: "action", decision: query.get("id") ?? "" };
    query.delete("id");
  } else if (path.startsWith("money/")) {
    segment = "money/overview";
    const view = path.slice("money/".length);
    extra = { view: view === "weekly" ? "week" : view };
  } else if (path.startsWith("operations/")) {
    segment = "operations";
    extra = { kind: path.slice("operations/".length) };
  } else if (path.startsWith("today/checklists/")) {
    segment = "home";
    extra = {};
  } else {
    segment = path;
  }

  for (const [k, v] of Object.entries(extra)) if (v) put(k, v);
  for (const [k, v] of query) if (!out.has(k)) put(k, v);
  if (!out.has("venue")) put("venue", venueId);
  const qs = out.toString();
  return `${pathFor(personaId, segment)}${qs ? `?${qs}` : ""}${hash}`;
}

/** True when the persona may open the destination. Forbidden destinations must not be linked at all. */
export function linkAllowed(
  personaId: PersonaId,
  mode: Mode,
  resolved: string,
): boolean {
  const segment = resolved.split("?")[0]?.split("/")[3] ?? "";
  return routeAllowed(personas[personaId], mode, segment);
}
