import { notFound } from "next/navigation";
import { InboxDetail } from "@/proto/features/inbox/inbox-detail";
import { personas } from "@/proto/fixtures/personas";
import type { PersonaId } from "@/proto/types";

export default async function Page({
  params,
}: {
  params: Promise<{ persona: string; id: string }>;
}) {
  const { persona, id } = await params;
  if (!Object.hasOwn(personas, persona)) notFound();
  return <InboxDetail personaId={persona as PersonaId} rawId={id} />;
}
