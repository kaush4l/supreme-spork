"use client";

import { DeniedPanel } from "../../components/denied-panel";
import { personas } from "../../fixtures/personas";
import { useProto } from "../../state/store";
import type { PersonaId } from "../../types";
import { BookkeeperHome } from "./bookkeeper-home";
import { effectiveMode, homeKindFor, showsMoneyGlance } from "./home-kind";
import { ManagerToday } from "./manager-today";
import { OwnerHome } from "./owner-home";
import { StaffTodayView } from "./staff-today";

/** Renders the right Home from capabilities and mode. Forbidden destinations are never linked from any home. */
export function HomeDispatcher({ personaId }: { personaId: PersonaId }) {
  const persona = personas[personaId];
  const p = useProto();
  const mode = effectiveMode(persona, p.mode);
  const kind = homeKindFor(persona, p.mode);
  const ctx = { personaId, venueId: p.venueId, mode };
  switch (kind) {
    case "owner":
      return <OwnerHome ctx={ctx} />;
    case "manager":
      return <ManagerToday ctx={ctx} moneyGlance={showsMoneyGlance(persona)} />;
    case "bookkeeper":
      return <BookkeeperHome ctx={ctx} />;
    case "staff":
      return <StaffTodayView ctx={ctx} />;
    default:
      return <DeniedPanel />;
  }
}
