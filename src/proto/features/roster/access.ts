"use client";

import { can, personas } from "../../fixtures/personas";
import { defaultMode, type Mode, routeAllowed } from "../../state/nav";
import { useProto } from "../../state/store";
import type { PersonaId } from "../../types";

/** Same mode/route rules the persona shell applies, plus the roster.edit capability. */
export function useTeamAccess(personaId: PersonaId) {
  const persona = personas[personaId];
  const { mode: m } = useProto();
  const mode: Mode = m && persona.modes.includes(m) ? m : defaultMode(persona);
  return {
    persona,
    teamAllowed: routeAllowed(persona, mode, "team"),
    rosterAllowed:
      routeAllowed(persona, mode, "team") && can(persona, "roster.edit"),
  };
}
