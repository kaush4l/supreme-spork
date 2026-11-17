import { redirect } from "next/navigation";

export default async function PersonaIndex({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  redirect(`/proto/${persona}/home`);
}
