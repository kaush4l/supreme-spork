import { MoneyLanding } from "@/proto/features/queue/money-pages";
import type { PersonaId } from "@/proto/types";

export default async function MoneyPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  return <MoneyLanding personaId={persona as PersonaId} />;
}
