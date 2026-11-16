import { Banner } from "@astryxdesign/core/Banner";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchAttention } from "@/server/data/attention";
import { myRights } from "@/server/data/me";
import { mayOpen } from "@/server/nav";
import { AttentionCard } from "./attention-card";
import { targetPage } from "./targets";
import { SEVERITIES } from "./words";

export const metadata = { title: "Needs attention" };

export default async function AttentionPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/attention`;
  const [me, rights, attention] = await Promise.all([
    fetchMe(backend(token)),
    myRights(token, venueId, here),
    fetchAttention(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  // A button shows only when the person's navigation has the page it leads to.
  const hrefFor = (kind: string, id: string | null | undefined) => {
    const page = targetPage(kind, id);
    return page && mayOpen(rights, page.nav)
      ? `/venues/${venueId}${page.path}`
      : null;
  };
  const known = new Set<string>(SEVERITIES.map((s) => s.key));
  const other = attention.items.filter((i) => !known.has(i.severity));

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Needs attention</Heading>
      {attention.items.length === 0 ? (
        <Text type="body">Nothing needs you right now.</Text>
      ) : (
        <Text type="body">
          {attention.total === 1
            ? "1 thing needs you."
            : `${attention.total} things need you.`}
        </Text>
      )}
      {attention.truncated ? (
        <Banner
          status="warning"
          title={`Showing the first ${attention.items.length} of ${attention.total}.`}
          description="Deal with these and the rest will appear."
        />
      ) : null}
      {[
        ...SEVERITIES.map((s) => ({
          key: s.key,
          heading: s.heading,
          items: attention.items.filter((i) => i.severity === s.key),
        })),
        { key: "other", heading: "Other", items: other },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <VStack key={group.key} gap={3} hAlign="stretch">
            <Heading level={2}>{group.heading}</Heading>
            {group.items.map((item) => (
              <AttentionCard
                key={item.id}
                item={item}
                tz={tz}
                href={hrefFor(item.target.kind, item.target.id)}
              />
            ))}
          </VStack>
        ))}
    </VStack>
  );
}
