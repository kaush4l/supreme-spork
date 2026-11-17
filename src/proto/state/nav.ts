import type { Capability, Persona } from "../types";

export type Mode = "staff" | "management";
export type DestKey =
  | "home"
  | "team"
  | "operations"
  | "money"
  | "inbox"
  | "shifts"
  | "me";

export interface Destination {
  key: DestKey;
  label: string;
  /** Path segment under /proto/<persona>/. */
  segment: DestKey;
}

const LABELS: Record<DestKey, string> = {
  home: "Home",
  team: "Team",
  operations: "Operations",
  money: "Money",
  inbox: "Inbox",
  shifts: "Shifts",
  me: "Me",
};

function d(key: DestKey, label?: string): Destination {
  return { key, label: label ?? LABELS[key], segment: key };
}

const has = (p: Persona, c: Capability) => p.capabilities.includes(c);

/** Money destination needs a money.* read right. cash.record alone never exposes it. */
export function canSeeMoney(p: Persona): boolean {
  return (
    has(p, "money.overview") ||
    has(p, "money.dockets.read") ||
    has(p, "money.dockets.review") ||
    has(p, "money.labour.aggregate")
  );
}

export function canManage(p: Persona): boolean {
  return has(p, "ops.manage");
}

/** The mode a persona opens in. */
export function defaultMode(p: Persona): Mode {
  return p.modes[0] ?? "staff";
}

export function hasModeSwitch(p: Persona): boolean {
  return p.modes.includes("staff") && p.modes.includes("management");
}

/** Primary navigation derived from capabilities, never from role labels. Always four items. */
export function navFor(p: Persona, mode: Mode): Destination[] {
  const effective: Mode = p.modes.includes(mode) ? mode : defaultMode(p);
  if (effective === "staff") {
    return [d("home", "Today"), d("shifts"), d("inbox"), d("me")];
  }
  const manage = canManage(p);
  const money = canSeeMoney(p);
  if (manage && money) {
    return [d("home"), d("team"), d("operations"), d("money")];
  }
  if (manage) {
    return [d("home"), d("team"), d("operations"), d("inbox")];
  }
  if (money) {
    return [d("home"), d("money"), d("inbox"), d("me")];
  }
  return [d("home", "Today"), d("shifts"), d("inbox"), d("me")];
}

/** Capability needed to open a route, or null when any persona may. */
export function routeAllowed(p: Persona, mode: Mode, segment: string): boolean {
  const inNav = navFor(p, mode).some((x) => x.segment === segment);
  if (inNav) return true;
  // Inbox is a header destination for management personas even when not in the bottom nav.
  if (segment === "inbox") return true;
  if (segment === "me") return true;
  return false;
}

export function pathFor(personaId: string, segment: string): string {
  return `/proto/${personaId}/${segment}`;
}

/** Where a denied person recovers to. */
export function recoveryFor(p: Persona, mode: Mode): Destination {
  return navFor(p, mode)[0];
}
