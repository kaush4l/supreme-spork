import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import type { ReactNode } from "react";

/** The frame every signed-out page shares: a centred card with a title, the form, and a line of links below. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Center padding={6}>
      <VStack gap={4} hAlign="center" width="100%">
        <Card padding={8} width="100%">
          <VStack gap={4} hAlign="stretch">
            <VStack gap={1} hAlign="center">
              <Heading level={1}>{title}</Heading>
              {subtitle ? (
                <Text type="body" color="secondary" size="sm">
                  {subtitle}
                </Text>
              ) : null}
            </VStack>
            {children}
          </VStack>
        </Card>
        {footer ? (
          <Text type="supporting" color="secondary">
            {footer}
          </Text>
        ) : null}
      </VStack>
    </Center>
  );
}
