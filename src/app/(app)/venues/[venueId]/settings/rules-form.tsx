"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changesFrom, toDraft } from "@/server/data/rule-values";
import type { RosterRules } from "@/server/data/settings";
import { saveRosterRules } from "./actions";

/**
 * The roster rules, drawn from what the backend describes: its groups, labels, help text, choices and limits. A new
 * rule on the backend appears here without a change to this page. Nothing is saved until "Save rules".
 */
export function RulesForm({
  venueId,
  rules,
  canEdit,
}: {
  venueId: string;
  rules: RosterRules;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rules.items.map((r) => [r.key, toDraft(r)])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (ruleKey: string, value: string) => {
    setSaved(false);
    setDrafts((now) => ({ ...now, [ruleKey]: value }));
  };

  const save = () =>
    start(async () => {
      setMessage(null);
      const { changes, bad } = changesFrom(rules.items, drafts);
      if (bad.length > 0) {
        const names = rules.items
          .filter((r) => bad.includes(r.key))
          .map((r) => r.label);
        setMessage(`Check the number for: ${names.join(", ")}.`);
        return;
      }
      const result = await saveRosterRules({ venueId, key, rules: changes });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setKey(crypto.randomUUID());
      setSaved(true);
      router.refresh();
    });

  return (
    <VStack gap={4} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {saved ? <Banner status="success" title="Rules saved." /> : null}
      {!canEdit ? (
        <Banner
          status="info"
          title="Only the owner and partners can change these. You can see them."
        />
      ) : null}
      {rules.groups.map((group) => (
        <Card key={group.key} padding={4}>
          <VStack gap={4} hAlign="stretch">
            <Heading level={3}>{group.label}</Heading>
            {rules.items
              .filter((r) => r.group === group.key)
              .map((rule) => {
                const draft = drafts[rule.key] ?? toDraft(rule);
                const isOff = draft === "off";
                return (
                  <VStack key={rule.key} gap={1} hAlign="stretch">
                    <Text type="body">{rule.label}</Text>
                    <Text type="supporting" color="secondary">
                      {rule.help}
                    </Text>
                    {rule.kind === "choice" || rule.kind === "yesno" ? (
                      <SegmentedControl
                        label={rule.label}
                        value={draft}
                        isDisabled={!canEdit || pending}
                        onChange={(v: string) => set(rule.key, v)}
                      >
                        {(rule.choices ?? []).map((c) => (
                          <SegmentedControlItem
                            key={JSON.stringify(c.value)}
                            value={JSON.stringify(c.value)}
                            label={c.label}
                          />
                        ))}
                      </SegmentedControl>
                    ) : (
                      <HStack gap={3} wrap="wrap" vAlign="end">
                        <TextInput
                          label={`${rule.label}${rule.unit ? ` (${rule.unit})` : ""}`}
                          isLabelHidden
                          inputMode="numeric"
                          value={isOff ? "" : draft}
                          placeholder={isOff ? "Off" : undefined}
                          isDisabled={!canEdit || pending || isOff}
                          onChange={(v: string) => set(rule.key, v)}
                          description={
                            rule.min !== undefined && rule.max !== undefined
                              ? `${rule.min} to ${rule.max}${rule.unit ? ` ${rule.unit}` : ""}`
                              : undefined
                          }
                        />
                        {rule.can_be_off ? (
                          <Switch
                            label={`${rule.label}: off`}
                            description="Off"
                            value={isOff}
                            isDisabled={!canEdit || pending}
                            onChange={(checked: boolean) =>
                              set(
                                rule.key,
                                checked ? "off" : String(rule.min ?? 1),
                              )
                            }
                          />
                        ) : null}
                      </HStack>
                    )}
                  </VStack>
                );
              })}
          </VStack>
        </Card>
      ))}
      {canEdit ? (
        <Button
          label="Save rules"
          variant="primary"
          size="lg"
          isLoading={pending}
          onClick={save}
        />
      ) : null}
    </VStack>
  );
}
