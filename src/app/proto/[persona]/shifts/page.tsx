import { notFound } from "next/navigation";
import { ShiftsPage } from "@/proto/features/homes/shifts-page";
import { personas } from "@/proto/fixtures/personas";

export default async function Page({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  if (!Object.hasOwn(personas, persona)) notFound();
  return <ShiftsPage />;
}
