import { VStack } from "@astryxdesign/core/Layout";
import { Skeleton } from "@astryxdesign/core/Skeleton";

export default function Loading() {
  return (
    <VStack gap={4} hAlign="stretch">
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </VStack>
  );
}
