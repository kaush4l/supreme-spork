import { Card, Heading, Stack, Text } from "@astryxdesign/core";
import { Button } from "@astryxdesign/core/Button";

export default function Home() {
  return (
    <Stack padding={6} align="start">
      <Card maxWidth={560} elevation="low">
        <Stack gap={3} align="start">
          <Heading level={1}>Supreme Spork</Heading>
          <Text>
            Next.js + Bun + Biome + TypeScript + Astryx — no Tailwind, styled
            with Astryx components and the neutral theme.
          </Text>
          <Button label="Hello Astryx" variant="primary" />
        </Stack>
      </Card>
    </Stack>
  );
}
