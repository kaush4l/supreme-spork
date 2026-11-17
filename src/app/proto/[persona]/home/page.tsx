import { notFound } from "next/navigation";
import { HomeDispatcher } from "@/proto/features/homes/home-dispatcher";
import { personas } from "@/proto/fixtures/personas";
import type { PersonaId } from "@/proto/types";

export default async function Page({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!Object.hasOwn(personas, persona)) notFound();
  return <HomeDispatcher personaId={persona as PersonaId} />;
}
