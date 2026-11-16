import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { rosterPositions } from "@/server/data/roster";
import { rosterTemplate } from "@/server/data/roster-extras";
import { ApplyCard } from "../apply-card";
import { TemplateForm } from "../template-form";

export const metadata = { title: "Staffing template" };

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ venueId: string; templateId: string }>;
}) {
  const { venueId, templateId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(templateId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/roster/templates/${templateId}`;
  const [t, positions] = await Promise.all([
    rosterTemplate(token, venueId, templateId, here),
    rosterPositions(token, venueId, here),
  ]);

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>{t.name}</Heading>
      <Link href={`/venues/${venueId}/roster/templates`}>
        Back to templates
      </Link>
      {t.active ? (
        <ApplyCard
          venueId={venueId}
          templateId={t.id}
          lengthDays={t.length_days}
        />
      ) : (
        <Text type="body" color="secondary">
          This template is retired. Bring it back to use it.
        </Text>
      )}
      <TemplateForm
        key={JSON.stringify(t)}
        venueId={venueId}
        positions={positions.filter((p) => p.active).map((p) => p.name)}
        existing={{
          id: t.id,
          name: t.name,
          lengthDays: t.length_days,
          active: t.active,
          slots: t.slots,
        }}
      />
    </VStack>
  );
}
