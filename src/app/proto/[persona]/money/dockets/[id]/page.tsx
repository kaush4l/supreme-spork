import { DocketDetail } from "@/proto/features/queue/docket-detail";
import type { PersonaId } from "@/proto/types";

export default async function MoneyDocketDetailPage({
  params,
}: {
  params: Promise<{ persona: string; id: string }>;
}) {
  const { persona, id } = await params;
  return (
    <DocketDetail
      personaId={persona as PersonaId}
      id={decodeURIComponent(id)}
    />
  );
}
