"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { personas } from "../../fixtures/personas";
import { useProto } from "../../state/store";
import type { PersonaId } from "../../types";

const GROUPS = [
  "Shift offers and roster changes",
  "Requests and decisions",
  "Tasks and late clock-ins",
  "Cash and pay (sensitive)",
  "Announcements",
];
const CHANNELS = ["In-app", "Email", "Push"];

export function MePage({ personaId }: { personaId: PersonaId }) {
  const persona = personas[personaId];
  const p = useProto();
  return (
    <VStack gap={5} hAlign="stretch">
      <VStack gap={1} hAlign="stretch">
        <Heading level={2}>Me</Heading>
        <Text type="supporting">{`Sample data · ${persona.label} · ${persona.roleLabel}`}</Text>
      </VStack>

      <VStack
        gap={2}
        hAlign="stretch"
        as="section"
        id="account"
        aria-label="Account and security"
      >
        <Heading level={3}>Account and security</Heading>
        <Text>{`Signed in as ${persona.label} (sample person, no real account).`}</Text>
        <Text weight="semibold">
          Two-step sign-in (MFA): On (design example)
        </Text>
        <Text type="supporting">
          This is a design example only. The prototype does not read or change
          any real security setting, and no sign-in service is called.
        </Text>
      </VStack>

      <VStack
        gap={2}
        hAlign="stretch"
        as="section"
        id="notifications"
        aria-label="Notification preferences"
      >
        <Heading level={3}>Notification preferences</Heading>
        <Banner
          status="warning"
          collapsible={false}
          title="Not supported by the current backend"
          description="Per-channel and per-kind preferences do not exist in the backend yet. The switches below show the intended design and cannot be changed."
        />
        {GROUPS.map((g) => (
          <VStack key={g} gap={1} hAlign="stretch" as="section" aria-label={g}>
            <Text weight="semibold">{g}</Text>
            <HStack gap={3} wrap="wrap">
              {CHANNELS.map((c) => (
                <Switch
                  key={c}
                  label={`${g}: ${c}`}
                  isLabelHidden={false}
                  value={c === "In-app"}
                  isDisabled
                  disabledMessage="Not supported by the current backend"
                  size="sm"
                />
              ))}
            </HStack>
          </VStack>
        ))}
        <Text type="supporting">
          Quiet hours (design): 21:00 to 06:30 venue time. Email and push would
          be held, in-app notices are not. Sensitive kinds (cash, requests,
          changes) would send generic push text only. Not supported by the
          current backend.
        </Text>
      </VStack>

      <VStack
        gap={2}
        hAlign="stretch"
        as="section"
        aria-label="Alerts on this phone"
      >
        <Heading level={3}>Alerts on this phone</Heading>
        <Text>
          Alerts on this phone would deliver push notices to this device only.
          The prototype never asks the browser for permission and never
          registers a push subscription.
        </Text>
        <Text type="supporting" weight="semibold">
          Status: not available in the prototype
        </Text>
      </VStack>

      <VStack gap={2} hAlign="stretch" as="section" aria-label="Sign out">
        <Heading level={3}>Sign out</Heading>
        <Banner
          status="info"
          collapsible={false}
          title="Simulation only: nothing real is revoked"
          description="Sign out here moves the prototype into a labelled signed-out screen. No session, device or push subscription exists, so none is revoked."
        />
        <Button
          label="Sign out (simulation)"
          variant="secondary"
          onClick={p.signOut}
          style={{ minBlockSize: "2.75rem" }}
        />
        <Banner
          status="info"
          collapsible={false}
          title="Production sign-out contract (documented, not simulated here)"
          description="Production sign-out contract (not simulated here): revoke this device server-side while credentials remain, unsubscribe locally, then clear session; sign-out everywhere covers all subscriptions; offline/revocation failure retried without blocking logout indefinitely."
        />
      </VStack>
    </VStack>
  );
}
