"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { personas } from "../fixtures/personas";
import { venues } from "../fixtures/venues";
import {
  defaultMode,
  hasModeSwitch,
  type Mode,
  navFor,
  pathFor,
  routeAllowed,
} from "../state/nav";
import { useProto } from "../state/store";
import type { PersonaId } from "../types";
import { DeniedPanel } from "./denied-panel";

function PrimaryNav({
  personaId,
  mode,
  pathname,
  placement,
}: {
  personaId: PersonaId;
  mode: Mode;
  pathname: string;
  placement: "bottom" | "top";
}) {
  const items = navFor(personas[personaId], mode);
  return (
    <nav
      aria-label="Primary"
      style={{
        position: placement === "bottom" ? "sticky" : "static",
        insetBlockEnd: 0,
        zIndex: 40,
        background: "var(--color-background-body)",
        borderBlockStart:
          placement === "bottom" ? "1px solid var(--color-border)" : undefined,
        borderBlockEnd:
          placement === "top" ? "1px solid var(--color-border)" : undefined,
      }}
    >
      <HStack
        gap={placement === "bottom" ? 0 : 1}
        padding={1}
        justify="between"
        align="stretch"
      >
        {items.map((it) => {
          const href = pathFor(personaId, it.segment);
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Button
              key={it.key}
              label={it.label}
              href={href}
              size={placement === "bottom" ? "md" : "lg"}
              variant={current ? "primary" : "ghost"}
              aria-current={current ? "page" : undefined}
              style={{ minBlockSize: "2.75rem", minInlineSize: "2.75rem" }}
              width={placement === "bottom" ? "100%" : undefined}
            />
          );
        })}
      </HStack>
    </nav>
  );
}

function SignedOutScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <VStack gap={4} padding={6} hAlign="start" maxWidth={640}>
      <Banner
        status="info"
        title="Simulated sign-out — target behaviour only; no real push subscription was revoked"
        description="Nothing was sent and no session exists. Sign back in to return to the sample data."
        collapsible={false}
      />
      <Button
        label="Sign back in (simulation)"
        variant="primary"
        onClick={onSignIn}
      />
    </VStack>
  );
}

export function PersonaShell({
  personaId,
  children,
}: {
  personaId: PersonaId;
  children: ReactNode;
}) {
  const persona = personas[personaId];
  const p = useProto();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const desktop = useMediaQuery("(min-width: 1024px)");
  const mode: Mode =
    p.mode && persona.modes.includes(p.mode) ? p.mode : defaultMode(persona);
  const segment = pathname.split("/")[3] ?? "home";

  // A venue this persona does not belong to falls back to their first venue.
  useEffect(() => {
    if (!persona.venueIds.includes(p.venueId))
      p.setVenue(persona.venueIds[0], { force: true });
  }, [persona, p.venueId, p.setVenue]);

  if (p.signedOut) return <SignedOutScreen onSignIn={p.signIn} />;

  const venueOptions = venues
    .filter((v) => persona.venueIds.includes(v.id))
    .map((v) => ({
      value: v.id,
      label: v.name,
      description: `${v.timezone}${v.empty ? " · no data yet" : ""}`,
    }));
  const allowed = routeAllowed(persona, mode, segment);
  const nav = (placement: "bottom" | "top") => (
    <PrimaryNav
      personaId={personaId}
      mode={mode}
      pathname={pathname}
      placement={placement}
    />
  );

  return (
    <VStack gap={0} hAlign="stretch">
      <HStack
        gap={3}
        padding={3}
        wrap="wrap"
        vAlign="center"
        justify="between"
        as="header"
      >
        <VStack gap={0} hAlign="start">
          <Heading level={1}>{persona.label}</Heading>
          <Text type="supporting">{persona.roleLabel}</Text>
        </VStack>
        <HStack gap={2} wrap="wrap" vAlign="center">
          <Selector
            label="Venue"
            isLabelHidden
            variant="secondary"
            presentation="adaptive"
            value={p.venueId}
            options={venueOptions}
            onChange={(v) => {
              p.setVenue(v);
            }}
          />
          {hasModeSwitch(persona) && (
            <SegmentedControl
              label="Mode"
              value={mode}
              onChange={(v) => {
                p.setMode(v as Mode);
                router.push(pathFor(personaId, "home"));
              }}
            >
              <SegmentedControlItem value="staff" label="Staff" />
              <SegmentedControlItem value="management" label="Management" />
            </SegmentedControl>
          )}
          {mode === "management" && (
            <Button
              label="Inbox"
              href={pathFor(personaId, "inbox")}
              aria-label="Inbox"
            />
          )}
          <DropdownMenu
            presentation="adaptive"
            placement="below"
            alignment="end"
            button={{
              label: "Account",
              variant: "secondary",
              style: { minBlockSize: "2.75rem" },
            }}
            items={[
              {
                label: "Account and security",
                href: `${pathFor(personaId, "me")}#account`,
              },
              {
                label: "Notification preferences",
                href: `${pathFor(personaId, "me")}#notifications`,
              },
              { type: "divider" },
              { label: "Sign out (simulation)", onClick: p.signOut },
            ]}
          />
        </HStack>
      </HStack>
      {desktop && nav("top")}
      <VStack gap={3} padding={3} hAlign="stretch" minHeight="60dvh">
        {allowed ? (
          children
        ) : (
          <DeniedPanel
            recoveryHref={pathFor(personaId, "home")}
            recoveryLabel="Go to Home"
          />
        )}
      </VStack>
      {!desktop && nav("bottom")}
    </VStack>
  );
}
