import { LabourAggregate } from "@/proto/features/queue/money-pages";
import type { PersonaId } from "@/proto/types";

export default async function MoneyLabourPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  return <LabourAggregate personaId={persona as PersonaId} />;
}
