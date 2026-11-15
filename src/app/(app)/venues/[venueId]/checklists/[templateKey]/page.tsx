import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { getTemplate } from "@/server/data/checklists";
import { ItemEditor, NewItem } from "./items";
import { TemplateActions } from "./template-actions";

export const metadata = { title: "Checklist" };

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ venueId: string; templateKey: string }>;
}) {
  const { venueId, templateKey } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/checklists/${templateKey}`;
  const template = await getTemplate(
    principal.accessToken,
    venueId,
    templateKey,
    here,
  );
  const items = template.items ?? [];
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/checklists`}>All checklists</Link>
      <Heading level={1}>{template.name}</Heading>
      {template.description ? (
        <Text type="supporting" color="secondary">
          {template.description}
        </Text>
      ) : null}
      {items.length === 0 ? (
        <Text type="supporting" color="secondary">
          This checklist has no items yet.
        </Text>
      ) : null}
      {items.map((item) => (
        <ItemEditor
          key={item.item_key}
          venueId={venueId}
          templateKey={templateKey}
          item={{
            itemKey: item.item_key ?? "",
            label: item.label,
            kind: item.kind,
            required: item.required,
            instruction: item.instruction ?? "",
            min: item.min_value ?? null,
            max: item.max_value ?? null,
          }}
        />
      ))}
      {template.retired ? (
        <Text type="supporting" color="secondary">
          This checklist is retired. Lists already issued from it are unchanged.
        </Text>
      ) : (
        <>
          <NewItem venueId={venueId} templateKey={templateKey} />
          <TemplateActions venueId={venueId} templateKey={templateKey} />
        </>
      )}
    </VStack>
  );
}
