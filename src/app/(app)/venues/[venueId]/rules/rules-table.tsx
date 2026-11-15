"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRight } from "../../../actions";

export type Right = {
  key: string;
  category: string;
  label: string;
  help: string;
  default_roles: string[];
  roles: string[];
  changed: boolean;
};
export type Category = { key: string; label: string };

const ROLE_LABEL: Record<string, string> = {
  partner: "Partner",
  manager: "Manager",
  bookkeeper: "Bookkeeper",
};

/**
 * Every right with a switch for each role the owner may change. The owner always holds every right and staff never
 * hold management rights, so neither has a switch. A switch set back to the default sends "reset", so the owner's rules
 * list only what really differs.
 */
export function RulesTable({
  venueId,
  rights,
  categories,
  grantable,
  canEdit,
}: {
  venueId: string;
  rights: Right[];
  categories: Category[];
  grantable: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (right: Right, role: string, checked: boolean) =>
    start(async () => {
      const isDefault = right.default_roles.includes(role) === checked;
      const result = await setRight({
        venueId,
        capability: right.key,
        role: role as "partner" | "manager" | "bookkeeper",
        allowed: isDefault ? null : checked,
      });
      if (!result.ok) setMessage(result.error.message);
      else {
        setMessage(null);
        router.refresh();
      }
    });

  return (
    <VStack gap={4} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {!canEdit ? (
        <Banner
          status="info"
          title="Only the owner can change these. You can see them."
        />
      ) : null}
      {categories.map((category) => (
        <Card key={category.key} padding={4}>
          <VStack gap={3} hAlign="stretch">
            <Heading level={3}>{category.label}</Heading>
            {rights
              .filter((right) => right.category === category.key)
              .map((right) => (
                <VStack key={right.key} gap={1} hAlign="stretch">
                  <Text type="body">{right.label}</Text>
                  <Text type="supporting" color="secondary">
                    {right.help}
                  </Text>
                  <HStack gap={4}>
                    {grantable.map((role) => (
                      <Switch
                        key={role}
                        label={`${ROLE_LABEL[role] ?? role}: ${right.label}`}
                        isLabelHidden
                        description={ROLE_LABEL[role] ?? role}
                        value={right.roles.includes(role)}
                        isDisabled={!canEdit || pending}
                        onChange={(checked: boolean) =>
                          toggle(right, role, checked)
                        }
                      />
                    ))}
                  </HStack>
                </VStack>
              ))}
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}
