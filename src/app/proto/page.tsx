import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { personas } from "@/proto/fixtures/personas";
import { hasModeSwitch, navFor } from "@/proto/state/nav";
import type { PersonaId } from "@/proto/types";

const ORDER: PersonaId[] = [
  "owner",
  "partner",
  "manager-money",
  "manager",
  "staff",
  "bookkeeper",
  "multi",
];

const EVIDENCE_ROOT = "minder-pass-documents/ui/redesign/phase-2/evidence";
const EVIDENCE = [
  {
    folder: `${EVIDENCE_ROOT}/homes/`,
    covers:
      "Home screens for owner, manager, staff and bookkeeper at phone, desktop and 200% zoom; states and drill-downs (V01 to V05, V12, V13).",
  },
  {
    folder: `${EVIDENCE_ROOT}/inbox/`,
    covers:
      "Inbox, Me and announcements: read versus resolved, mark all read, refresh and removed items (V06, V07, V12, V14, V15).",
  },
  {
    folder: `${EVIDENCE_ROOT}/queue/`,
    covers:
      "Docket queue, filters, detail, read-only access and Money overview (V05, V08, V09, V12, V15).",
  },
  {
    folder: `${EVIDENCE_ROOT}/roster/`,
    covers:
      "Roster agenda and grid, shift form, publish review, venue switch and empty venue (V10, V11, V12).",
  },
];

function summary(id: PersonaId): string {
  const p = personas[id];
  const modes = p.modes.map((m) => ({
    m,
    nav: navFor(p, m).map((n) => n.label),
  }));
  const parts = modes.map((x) =>
    hasModeSwitch(p) ? `${x.m} mode: ${x.nav.join(", ")}` : x.nav.join(", "),
  );
  return `Sees ${parts.join(" | ")}. Venues: ${p.venueIds.length}.`;
}

export default function ProtoIndex() {
  return (
    <VStack gap={6} padding={4} hAlign="stretch" maxWidth={720}>
      <VStack gap={2} hAlign="stretch">
        <Heading level={1}>Prototype: choose a persona</Heading>
        <Text type="supporting">
          Every screen here uses sample data. Pick who you are acting as; what
          you see follows that person&apos;s access, not their job title.
        </Text>
      </VStack>
      <VStack gap={3} hAlign="stretch" as="section" aria-label="Personas">
        {ORDER.map((id) => {
          const p = personas[id];
          return (
            <Card key={id} padding={4}>
              <VStack gap={2} hAlign="start">
                <Heading level={2}>{p.label}</Heading>
                <Text weight="semibold">{p.roleLabel}</Text>
                <Text type="supporting">{summary(id)}</Text>
                <Button
                  label={`Open as ${p.label}`}
                  href={`/proto/${id}/home`}
                  variant="primary"
                />
              </VStack>
            </Card>
          );
        })}
      </VStack>
      <VStack gap={3} hAlign="stretch" as="section" aria-label="Evidence index">
        <Heading level={2}>Evidence index</Heading>
        <Text type="supporting">
          Evidence files (screenshots, results tables, test reports) live in the
          documents repository, not in this app. The paths below are plain text.
        </Text>
        <VStack gap={2} hAlign="stretch" as="ul" padding={0}>
          {EVIDENCE.map((e) => (
            <VStack key={e.folder} gap={0.5} hAlign="start" as="li">
              <Text weight="semibold">{e.folder}</Text>
              <Text type="supporting">{e.covers}</Text>
            </VStack>
          ))}
        </VStack>
        <Heading level={3}>Acceptance rows V01 to V16</Heading>
        <VStack gap={0.5} hAlign="stretch" as="ul" padding={0}>
          {Array.from({ length: 16 }, (_, i) => {
            const id = `V${String(i + 1).padStart(2, "0")}`;
            return (
              <VStack key={id} as="li" hAlign="start">
                <Text>{`${id}: see acceptance.md`}</Text>
              </VStack>
            );
          })}
        </VStack>
      </VStack>
    </VStack>
  );
}
