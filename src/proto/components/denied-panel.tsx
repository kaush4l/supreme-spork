"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { usePathname } from "next/navigation";

export interface DeniedPanelProps {
  title?: string;
  message?: string;
  /** Recovery destination inside /proto. Defaults to the persona's Home (or the persona picker). */
  recoveryHref?: string;
  recoveryLabel?: string;
}

/** "You do not have access" with a clear way back. Inline, so the rest of the screen stays usable. */
export function DeniedPanel({
  title = "Not available for your access",
  message = "Your role in this venue does not include this section. Nothing was changed.",
  recoveryHref,
  recoveryLabel,
}: DeniedPanelProps) {
  const pathname = usePathname() ?? "";
  const persona = pathname.split("/")[2];
  const href = recoveryHref ?? (persona ? `/proto/${persona}/home` : "/proto");
  const label = recoveryLabel ?? (persona ? "Go to Home" : "Back to personas");
  return (
    <VStack gap={2} hAlign="stretch">
      <Banner
        status="warning"
        title={title}
        description={message}
        collapsible={false}
        endContent={<Button label={label} href={href} variant="secondary" />}
      />
    </VStack>
  );
}
