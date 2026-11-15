"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { unlinkPerson } from "./actions";

/** Undo a wrong link between this profile and a login. Asks first. */
export function UnlinkButton({
  venueId,
  staffId,
  name,
}: {
  venueId: string;
  staffId: string;
  name: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const go = guard(async () => {
    setMessage(null);
    setPending(true);
    const result = await unlinkPerson({ venueId, staffId });
    setPending(false);
    setOpen(false);
    if (!result.ok) return setMessage(result.error.message);
    router.refresh();
  });

  return (
    <VStack gap={2} hAlign="start">
      <Text type="supporting" color="secondary">
        Linked to the wrong login? You can undo the link.
      </Text>
      {message ? <Banner status="error" title={message} /> : null}
      <Button
        label="Undo this link"
        variant="destructive"
        onClick={() => setOpen(true)}
      />
      <AlertDialog
        isOpen={open}
        onOpenChange={setOpen}
        title={`Undo ${name}'s link?`}
        description="This profile stops being tied to that login, and its email is cleared. Enter the right email next."
        actionLabel="Undo this link"
        actionVariant="destructive"
        isActionLoading={pending}
        onAction={go}
      />
    </VStack>
  );
}
