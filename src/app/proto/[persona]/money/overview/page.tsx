import { MoneyOverview } from "@/proto/features/queue/money-pages";
import type { PersonaId } from "@/proto/types";

export default async function MoneyOverviewPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  return <MoneyOverview personaId={persona as PersonaId} />;
}
