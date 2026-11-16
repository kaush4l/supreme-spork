import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { rosterPositions } from "@/server/data/roster";
import { rosterTemplates } from "@/server/data/roster-extras";
import { TemplateForm } from "./template-form";

export const metadata = { title: "Staffing templates" };

const LENGTH_WORDS: Record<number, string> = {
  1: "One day",
  7: "One week",
  14: "Two weeks",
};

export default async function TemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ retired?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const showRetired = (await searchParams).retired === "1";
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/roster/templates`;
  const [templates, positions] = await Promise.all([
    rosterTemplates(token, venueId, here, showRetired),
    rosterPositions(token, venueId, here),
  ]);
  const base = `/venues/${venueId}/roster/templates`;

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Staffing templates</Heading>
      <Link href={`/venues/${venueId}/roster`}>Back to the roster</Link>
      <Text type="supporting" color="secondary">
        A template says how many people each day needs. Use one on a week to
        make the open shifts.
      </Text>
      <VStack gap={2} hAlign="stretch">
        {templates.length === 0 ? (
          <Text type="body" color="secondary">
            {showRetired
              ? "There are no templates, retired or not."
              : "You have no templates yet. Make one below."}
          </Text>
        ) : (
          templates.map((t) => (
            <Card key={t.id} padding={4}>
              <VStack gap={1} hAlign="stretch">
                <Link href={`${base}/${t.id}`}>{t.name}</Link>
                <Text type="supporting" color="secondary">
                  {LENGTH_WORDS[t.length_days] ?? `${t.length_days} days`} ·{" "}
                  {t.slots.length} {t.slots.length === 1 ? "shift" : "shifts"}
                  {t.active ? "" : " · Retired"}
                </Text>
              </VStack>
            </Card>
          ))
        )}
        <Link href={showRetired ? base : `${base}?retired=1`}>
          {showRetired ? "Hide retired templates" : "Show retired templates"}
        </Link>
      </VStack>
      <TemplateForm
        venueId={venueId}
        positions={positions.filter((p) => p.active).map((p) => p.name)}
        existing={null}
      />
    </VStack>
  );
}
