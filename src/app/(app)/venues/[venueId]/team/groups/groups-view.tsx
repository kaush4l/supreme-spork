"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import {
  addGroup,
  addMember,
  removeMember,
  renameGroup,
  retireGroup,
} from "./actions";

export type GroupLine = {
  id: string;
  name: string;
  members: { staffId: string; name: string; active: boolean }[];
};
type Option = { value: string; label: string };

function GroupCard({
  venueId,
  group,
  people,
  onError,
}: {
  venueId: string;
  group: GroupLine;
  people: Option[];
  onError: (m: string | null) => void;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(group.name);
  const [pick, setPick] = useState("");
  const [retiring, setRetiring] = useState(false);
  const inGroup = new Set(group.members.map((m) => m.staffId));
  const choices = people.filter((p) => !inGroup.has(p.value));

  const run = guard(
    async (
      send: () => Promise<{ ok: boolean; error?: { message: string } }>,
    ) => {
      onError(null);
      setPending(true);
      const result = await send();
      setPending(false);
      if (!result.ok)
        return onError(result.error?.message ?? "That did not work.");
      setPick("");
      router.refresh();
    },
  );

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>{group.name}</Heading>
        {group.members.length === 0 ? (
          <Text type="supporting" color="secondary">
            Nobody in this group yet.
          </Text>
        ) : (
          group.members.map((m) => (
            <HStack key={m.staffId} gap={2} wrap="wrap">
              <Text type="body">{m.name}</Text>
              {m.active ? null : <Badge label="Left" variant="neutral" />}
              <Button
                label="Remove"
                aria-label={`Remove ${m.name} from ${group.name}`}
                isDisabled={pending}
                onClick={() =>
                  run(() =>
                    removeMember({
                      venueId,
                      groupId: group.id,
                      staffId: m.staffId,
                    }),
                  )
                }
              />
            </HStack>
          ))
        )}
        {choices.length > 0 ? (
          <HStack gap={2} wrap="wrap" vAlign="end">
            <Selector
              label="Add a person"
              options={choices}
              value={pick}
              onChange={setPick}
              hasSearch
            />
            <Button
              label="Add to group"
              isDisabled={pick === "" || pending}
              onClick={() =>
                run(() =>
                  addMember({ venueId, groupId: group.id, staffId: pick }),
                )
              }
            />
          </HStack>
        ) : null}
        <HStack gap={2} wrap="wrap" vAlign="end">
          <TextInput label="Group name" value={name} onChange={setName} />
          <Button
            label="Rename"
            isDisabled={
              pending || name.trim() === "" || name.trim() === group.name
            }
            onClick={() =>
              run(() => renameGroup({ venueId, groupId: group.id, name }))
            }
          />
        </HStack>
        <HStack gap={2}>
          <Button
            label="Retire group"
            aria-label={`Retire ${group.name}`}
            variant="destructive"
            onClick={() => setRetiring(true)}
          />
        </HStack>
      </VStack>
      <AlertDialog
        isOpen={retiring}
        onOpenChange={setRetiring}
        title={`Retire ${group.name}?`}
        description="The group leaves this list and is no longer used when you build the roster."
        actionLabel="Retire group"
        actionVariant="destructive"
        isActionLoading={pending}
        onAction={async () => {
          await run(() => retireGroup({ venueId, groupId: group.id }));
          setRetiring(false);
        }}
      />
    </Card>
  );
}

export function GroupsView({
  venueId,
  groups,
  people,
}: {
  venueId: string;
  groups: GroupLine[];
  people: Option[];
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const add = guard(async () => {
    setMessage(null);
    setPending(true);
    const result = await addGroup({ venueId, key, name });
    setPending(false);
    if (!result.ok) return setMessage(result.error.message);
    setKey(crypto.randomUUID());
    setName("");
    router.refresh();
  });

  return (
    <VStack gap={4} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {groups.length === 0 ? (
        <Text type="supporting" color="secondary">
          No groups yet. Add the first one below.
        </Text>
      ) : (
        groups.map((g) => (
          <GroupCard
            key={g.id}
            venueId={venueId}
            group={g}
            people={people}
            onError={setMessage}
          />
        ))
      )}
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Add a group</Heading>
          <TextInput label="New group name" value={name} onChange={setName} />
          <Button
            label="Add group"
            variant="primary"
            isLoading={pending}
            isDisabled={name.trim() === ""}
            onClick={add}
          />
        </VStack>
      </Card>
    </VStack>
  );
}
