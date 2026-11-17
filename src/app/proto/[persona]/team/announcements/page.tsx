import { notFound } from "next/navigation";
import { AnnouncementsPage } from "@/proto/features/inbox/announcements-page";
import { personas } from "@/proto/fixtures/personas";
import type { PersonaId } from "@/proto/types";

export default async function Page({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!Object.hasOwn(personas, persona)) notFound();
  return <AnnouncementsPage personaId={persona as PersonaId} />;
}
