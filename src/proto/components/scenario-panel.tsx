"use client";

import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { useAnnounce } from "@astryxdesign/core/hooks";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { parseScenario } from "../state/core";
import { useProto } from "../state/store";

const OPTIONS = [
  { value: "default", label: "Default" },
  { value: "busy", label: "Busy (many items)" },
  { value: "loading", label: "Loading (waits for you)" },
  { value: "empty", label: "Empty" },
  { value: "error", label: "Error" },
  { value: "stale", label: "Stale data" },
  { value: "denied", label: "Denied" },
  { value: "partial", label: "Partial data" },
  { value: "slow", label: "Slow (1.5 s)" },
];

/** Collapsible prototype controls, present on every proto screen. Pure client state: no network. */
export function ScenarioPanel() {
  const p = useProto();
  const announce = useAnnounce();
  return (
    <Collapsible
      defaultIsOpen={false}
      trigger={
        <Text weight="semibold">
          Prototype controls (scenario, reset, sign-out)
        </Text>
      }
    >
      <VStack gap={3} padding={3} hAlign="stretch">
        <Selector
          label="Scenario"
          description="Changes the sample data shown on every screen."
          value={p.scenario}
          options={OPTIONS}
          presentation="adaptive"
          onChange={(v) => {
            const s = parseScenario(v);
            if (s) p.setScenario(s);
          }}
        />
        <HStack gap={2} wrap="wrap" vAlign="center">
          {p.scenario === "loading" && !p.loadingReleased && (
            <Button
              label="Finish loading"
              variant="primary"
              onClick={() => {
                p.releaseLoading();
                announce("Loading finished");
              }}
            />
          )}
          <Button
            label="Reset fixtures"
            onClick={() => {
              p.resetFixtures();
              announce("Sample data reset to its starting state");
            }}
          />
        </HStack>
        <Switch
          label="Simulate signed-out"
          description="Shows the target signed-out behaviour only."
          value={p.signedOut}
          onChange={(on) => (on ? p.signOut() : p.signIn())}
        />
      </VStack>
    </Collapsible>
  );
}
