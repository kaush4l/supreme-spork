"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { finishList } from "./actions";

/** Finish the list. If something required is left, the backend's sentence says what; it is shown as it came. */
export function FinishBar({
  venueId,
  listId,
}: {
  venueId: string;
  listId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [left, setLeft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [late, setLate] = useState<boolean | null>(null);

  const onFinish = () =>
    start(async () => {
      setLeft(null);
      setProblem(null);
      const result = await finishList({ venueId, listId });
      if (result.ok) {
        setLate(result.data.late);
        router.refresh();
      } else if (result.error.code === "list_incomplete") {
        setLeft(result.error.message);
      } else {
        setProblem(result.error.message);
      }
    });

  return (
    <VStack gap={2} hAlign="stretch">
      {left ? (
        <Banner status="warning" title="Not finished yet" description={left} />
      ) : null}
      {problem ? <Banner status="error" title={problem} /> : null}
      {late !== null ? (
        <Banner
          status="success"
          title={late ? "Finished, a little late" : "Finished, well done"}
        />
      ) : null}
      <Button
        label="Finish list"
        variant="primary"
        size="lg"
        isLoading={pending}
        onClick={onFinish}
      />
    </VStack>
  );
}
