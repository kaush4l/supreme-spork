"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { addCategory } from "./actions";

export function AddCategoryForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () =>
    start(
      guard(async () => {
        setMessage(null);
        setNotice(null);
        const result = await addCategory({ venueId, key, label });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        setNotice(`Added ${label}.`);
        setLabel("");
        router.refresh();
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      <TextInput
        label="New category"
        value={label}
        onChange={setLabel}
        size="lg"
      />
      <Button
        label="Add category"
        variant="primary"
        size="lg"
        isLoading={pending}
        isDisabled={label.trim() === ""}
        onClick={submit}
      />
    </VStack>
  );
}
