"use client";

import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";

/** Shown when the venue is switched with unsaved roster edits. A draft always stays bound to its original venue. */
export function VenueSwitchDialog({
  open,
  fromName,
  toName,
  onKeep,
  onDiscard,
  onStay,
}: {
  open: boolean;
  fromName: string;
  toName: string;
  onKeep: () => void;
  onDiscard: () => void;
  onStay: () => void;
}) {
  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => {
        if (!o) onStay();
      }}
      purpose="form"
      width={520}
    >
      <DialogHeader
        title="Unsaved roster draft"
        onOpenChange={(o) => {
          if (!o) onStay();
        }}
      />
      <VStack gap={3} padding={4} hAlign="stretch">
        <Text as="p">
          {`You have unsaved roster changes for ${fromName}. You are switching to ${toName}.`}
        </Text>
        <Text type="supporting" as="p">
          {`A kept draft stays with ${fromName}. It will not appear on ${toName} and comes back only when you switch back to ${fromName}.`}
        </Text>
        <Button
          label={`Keep draft for ${fromName}`}
          variant="primary"
          onClick={onKeep}
        />
        <Button
          label="Discard draft"
          variant="destructive"
          onClick={onDiscard}
        />
        <Button label={`Stay on ${fromName}`} onClick={onStay} />
      </VStack>
    </Dialog>
  );
}
