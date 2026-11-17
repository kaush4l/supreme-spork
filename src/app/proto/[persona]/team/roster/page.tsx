import { RosterScreen } from "@/proto/features/roster/roster-screen";
import type { PersonaId } from "@/proto/types";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  return <RosterScreen personaId={persona as PersonaId} />;
}
