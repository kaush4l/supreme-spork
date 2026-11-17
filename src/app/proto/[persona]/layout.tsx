import { notFound } from "next/navigation";
import { PersonaShell } from "@/proto/components/persona-shell";
import { personas } from "@/proto/fixtures/personas";
import type { PersonaId } from "@/proto/types";

export default async function PersonaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!Object.hasOwn(personas, persona)) notFound();
  return (
    <PersonaShell personaId={persona as PersonaId}>{children}</PersonaShell>
  );
}
