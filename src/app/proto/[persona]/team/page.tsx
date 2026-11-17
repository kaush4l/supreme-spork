import { TeamLanding } from "@/proto/features/roster/team-landing";
import type { PersonaId } from "@/proto/types";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  return <TeamLanding personaId={persona as PersonaId} />;
}
