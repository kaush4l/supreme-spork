"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";

/** What a person sees when this page could not load: a plain sentence and a way to try again. */
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <VStack gap={3} hAlign="start">
      <Banner
        status="error"
        title="We could not load this page"
        description="Check your connection and try again."
      />
      <Button label="Try again" onClick={reset} />
    </VStack>
  );
}
