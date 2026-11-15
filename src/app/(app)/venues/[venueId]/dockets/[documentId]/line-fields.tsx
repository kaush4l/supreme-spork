"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { type Errors, type LineText, lineErrors } from "./payload";

/** One line's boxes. Errors for this line (from the backend or from typing) are shown right under it. */
export function LineFields({
  n,
  text,
  onChange,
  errors,
  canDrop,
  showUnit,
  onRemove,
}: {
  /** Position on screen, starting at 1: the number the backend uses in its field errors. */
  n: number;
  text: LineText;
  onChange: (next: LineText) => void;
  errors: Errors;
  canDrop?: boolean;
  showUnit?: boolean;
  onRemove?: () => void;
}) {
  const set = (patch: Partial<LineText>) => onChange({ ...text, ...patch });
  const own = lineErrors(errors, n);
  const bad = (field: string) =>
    errors[`lines[${n}].${field}`]
      ? ({ type: "error", message: errors[`lines[${n}].${field}`] } as const)
      : undefined;
  return (
    <Card padding={3} variant="muted">
      <VStack gap={2} hAlign="stretch">
        <Text type="label">Line {n}</Text>
        <TextInput
          label="What was delivered"
          value={text.description}
          onChange={(description) => set({ description })}
          status={bad("description")}
        />
        <TextInput
          label="Quantity"
          value={text.qty}
          onChange={(qty) => set({ qty })}
          inputMode="decimal"
          status={bad("qty")}
        />
        {showUnit ? (
          <TextInput
            label="Unit (kg, ea, case)"
            value={text.unitText}
            onChange={(unitText) => set({ unitText })}
            isOptional
          />
        ) : null}
        <TextInput
          label="Price each ($)"
          value={text.unitPrice}
          onChange={(unitPrice) => set({ unitPrice })}
          inputMode="decimal"
          status={bad("unit_price_cents")}
        />
        <TextInput
          label="Line total ($)"
          value={text.lineTotal}
          onChange={(lineTotal) => set({ lineTotal })}
          inputMode="decimal"
          isOptional
          status={bad("total_cents")}
        />
        {own.map((m) => (
          <Banner key={m} status="error" title={m} />
        ))}
        {canDrop ? (
          <CheckboxInput
            label="Remove this line"
            value={text.drop}
            onChange={(drop) => set({ drop })}
          />
        ) : null}
        {onRemove ? (
          <Button
            label={`Remove line ${n}`}
            size="sm"
            variant="ghost"
            onClick={onRemove}
          />
        ) : null}
      </VStack>
    </Card>
  );
}
