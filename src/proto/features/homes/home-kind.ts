import {
  canManage,
  canSeeMoney,
  defaultMode,
  type Mode,
} from "../../state/nav";
import type { Persona } from "../../types";

export type HomeKind = "owner" | "manager" | "staff" | "bookkeeper" | "none";

export function effectiveMode(persona: Persona, mode: Mode | null): Mode {
  return mode && persona.modes.includes(mode) ? mode : defaultMode(persona);
}

/** Which Home a persona gets, from capabilities and the current mode, never from the role label. */
export function homeKindFor(persona: Persona, mode: Mode | null): HomeKind {
  const eff = effectiveMode(persona, mode);
  if (eff === "staff") {
    return persona.capabilities.includes("staff.today") ||
      persona.capabilities.includes("docket.upload")
      ? "staff"
      : "none";
  }
  if (persona.capabilities.includes("venue.home.owner")) return "owner";
  if (canManage(persona)) return "manager";
  if (canSeeMoney(persona)) return "bookkeeper";
  return persona.capabilities.includes("staff.today") ? "staff" : "none";
}

/** Manager Today shows a compact money glance only when the persona may read money overview. */
export function showsMoneyGlance(persona: Persona): boolean {
  return persona.capabilities.includes("money.overview");
}
