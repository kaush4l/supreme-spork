"use client";

import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { type ReactNode, useState } from "react";
import { ProtoProvider } from "../state/store";
import { ScenarioPanel } from "./scenario-panel";

export const SAMPLE_DATA_LABEL =
  "Sample data — prototype, nothing is saved or sent";
export const MAIN_ID = "proto-main";

function SkipLink() {
  const [focused, setFocused] = useState(false);
  return (
    <a
      href={`#${MAIN_ID}`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        position: "absolute",
        insetInlineStart: 0,
        insetBlockStart: 0,
        zIndex: 100,
        padding: "var(--spacing-3)",
        background: "var(--color-background-body)",
        transform: focused ? "none" : "translateY(-200%)",
      }}
    >
      Skip to content
    </a>
  );
}

/**
 * Wraps every /proto page: state provider, skip link, the persistent sample-data bar and the scenario controls.
 * Makes no network call; links inside the prototype stay inside /proto.
 */
export function ProtoRoot({ children }: { children: ReactNode }) {
  return (
    <ProtoProvider>
      <SkipLink />
      <VStack
        gap={0}
        hAlign="stretch"
        style={{
          position: "sticky",
          insetBlockStart: 0,
          zIndex: 50,
          background: "var(--color-background-body)",
          borderBlockEnd: "1px solid var(--color-border)",
        }}
      >
        <VStack role="status" padding={2} paddingInline={4} hAlign="stretch">
          <Text weight="semibold">{SAMPLE_DATA_LABEL}</Text>
        </VStack>
        <ScenarioPanel />
      </VStack>
      <VStack as="main" id={MAIN_ID} tabIndex={-1} hAlign="stretch" gap={0}>
        {children}
      </VStack>
    </ProtoProvider>
  );
}
