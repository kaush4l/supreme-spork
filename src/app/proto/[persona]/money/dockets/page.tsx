import { Suspense } from "react";
import { DocketQueue } from "@/proto/features/queue/docket-queue";
import type { PersonaId } from "@/proto/types";

export default async function MoneyDocketsPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  return (
    <Suspense fallback={null}>
      <DocketQueue personaId={persona as PersonaId} />
    </Suspense>
  );
}
