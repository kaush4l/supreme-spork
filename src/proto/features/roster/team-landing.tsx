"use client";

import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMemo, useState } from "react";
import { searchStaff } from "../../adapter";
import { DeniedPanel } from "../../components/denied-panel";
import { staff } from "../../fixtures/staff";
import { pathFor } from "../../state/nav";
import type { PersonaId } from "../../types";
import { useTeamAccess } from "./access";

const LIMIT = 25;

function StaffDirectory() {
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const page = useMemo(() => searchStaff(staff, q, LIMIT, offset), [q, offset]);
  const first = page.total === 0 ? 0 : page.offset + 1;
  const last = page.offset + page.items.length;
  return (
    <VStack gap={2} hAlign="stretch" as="section" aria-label="Staff directory">
      <Heading level={2}>Staff directory</Heading>
      <TextInput
        label="Search staff"
        description="Search all staff by name or role"
        type="search"
        value={q}
        onChange={(v) => {
          setQ(v);
          setOffset(0);
        }}
        hasClear
        width="100%"
      />
      <Text type="supporting" as="p" aria-live="polite">
        {page.total === 0
          ? `No staff match "${q.trim()}".`
          : `${first} to ${last} of ${page.total} staff`}
      </Text>
      {page.total === 0 ? (
        <EmptyState
          title="No staff found"
          description="Check the spelling or clear the search to see everyone."
          isCompact
          actions={<Button label="Clear search" onClick={() => setQ("")} />}
        />
      ) : (
        <VStack gap={0} hAlign="stretch" as="ul" aria-label="Staff results">
          {page.items.map((s) => (
            <VStack
              key={s.id}
              gap={0.5}
              padding={2}
              hAlign="stretch"
              as="li"
              style={{ borderBlockEnd: "1px solid var(--color-border)" }}
            >
              <Text maxLines={2} wordBreak="break-word">
                {s.name}
              </Text>
              <Text type="supporting">{s.role}</Text>
            </VStack>
          ))}
        </VStack>
      )}
      <HStack gap={2} wrap="wrap">
        <Button
          label="Previous page"
          isDisabled={page.offset === 0}
          style={{ minBlockSize: "2.75rem" }}
          onClick={() => setOffset(Math.max(0, page.offset - LIMIT))}
        />
        <Button
          label="Next page"
          isDisabled={last >= page.total}
          style={{ minBlockSize: "2.75rem" }}
          onClick={() => setOffset(page.offset + LIMIT)}
        />
      </HStack>
    </VStack>
  );
}

export function TeamLanding({ personaId }: { personaId: PersonaId }) {
  const access = useTeamAccess(personaId);
  if (!access.teamAllowed) return <DeniedPanel />;
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={2}>Team</Heading>
      <HStack gap={2} wrap="wrap" as="nav" aria-label="Team sections">
        {access.rosterAllowed && (
          <Button
            label="Roster"
            variant="primary"
            href={pathFor(personaId, "team/roster")}
            style={{ minBlockSize: "2.75rem" }}
          />
        )}
        <Button
          label="Announcements"
          href={pathFor(personaId, "team/announcements")}
          style={{ minBlockSize: "2.75rem" }}
        />
      </HStack>
      {!access.rosterAllowed && (
        <Text type="supporting" as="p">
          Roster editing is not part of your access in this venue.
        </Text>
      )}
      <StaffDirectory />
    </VStack>
  );
}
