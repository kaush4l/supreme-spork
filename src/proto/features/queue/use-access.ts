"use client";

import { can, personas } from "../../fixtures/personas";
import {
  defaultMode,
  type Mode,
  pathFor,
  recoveryFor,
  routeAllowed,
} from "../../state/nav";
import { useProto } from "../../state/store";
import type { Capability, PersonaId } from "../../types";

/** Effective persona, mode and capability checks for a Money page. Never derives access from role labels. */
export function useAccess(personaId: PersonaId) {
  const persona = personas[personaId];
  const p = useProto();
  const mode: Mode =
    p.mode && persona.modes.includes(p.mode) ? p.mode : defaultMode(persona);
  return {
    persona,
    mode,
    moneyRoute: routeAllowed(persona, mode, "money"),
    has: (c: Capability) => can(persona, c),
    recoveryHref: pathFor(personaId, recoveryFor(persona, mode).segment),
    moneyHref: pathFor(personaId, "money"),
  };
}
