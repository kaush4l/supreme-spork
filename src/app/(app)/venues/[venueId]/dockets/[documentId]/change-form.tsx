"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { centsToInput } from "@/server/data/money-input";
import { changeDocket } from "./actions";
import { LineFields } from "./line-fields";
import {
  changeBody,
  type Errors,
  type Original,
  startingText,
} from "./payload";

/** Correct a docket: the boxes start as what it holds; only what changes is sent. A new version replaces the old. */
export function ChangeForm({
  venueId,
  documentId,
  original,
}: {
  venueId: string;
  documentId: string;
  original: Original;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [supplier, setSupplier] = useState(original.supplier ?? "");
  const [deliveryDate, setDeliveryDate] = useState(
    original.delivery_date ?? "",
  );
  const [invoiceNo, setInvoiceNo] = useState(original.invoice_no ?? "");
  const [total, setTotal] = useState(centsToInput(original.total_cents));
  const [lines, setLines] = useState(() => startingText(original));
  const [errors, setErrors] = useState<Errors>({});

  if (!open)
    return <Button label="Correct this docket" onClick={() => setOpen(true)} />;

  const submit = () =>
    start(async () => {
      const built = changeBody(original, {
        supplier,
        deliveryDate,
        invoiceNo,
        total,
        lines,
      });
      if (!built.ok) return setErrors(built.errors);
      setErrors({});
      const result = await changeDocket({
        venueId,
        documentId,
        key,
        ...built.body,
      });
      if (!result.ok)
        return setErrors({
          form: result.error.message,
          ...(result.error.fields ?? {}),
        });
      setKey(crypto.randomUUID());
      setOpen(false);
      router.refresh();
    });

  const field = (name: string) =>
    errors[name]
      ? ({ type: "error", message: errors[name] } as const)
      : undefined;
  // a message with no box of its own (for example the line total mismatch) is shown once at the top
  const own = new Set([
    "supplier",
    "delivery_date",
    "invoice_no",
    "total_cents",
  ]);
  const loose = Object.entries(errors)
    .filter(([k]) => !own.has(k) && !k.startsWith("lines["))
    .map(([, m]) => m);

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Correct this docket</Heading>
        {[...new Set(loose)].map((m) => (
          <Banner key={m} status="error" title={m} />
        ))}
        <TextInput
          label="Supplier"
          value={supplier}
          onChange={setSupplier}
          status={field("supplier")}
        />
        <TextInput
          label="Delivery date"
          value={deliveryDate}
          onChange={setDeliveryDate}
          placeholder="2026-11-03"
          status={field("delivery_date")}
        />
        <TextInput
          label="Invoice number"
          value={invoiceNo}
          onChange={setInvoiceNo}
          status={field("invoice_no")}
        />
        <TextInput
          label="Docket total ($)"
          value={total}
          onChange={setTotal}
          inputMode="decimal"
          status={field("total_cents")}
        />
        {lines.map((l, i) => (
          <LineFields
            key={l.line}
            n={l.line}
            text={l}
            errors={errors}
            canDrop
            onChange={(next) =>
              setLines((all) => all.map((x, j) => (j === i ? next : x)))
            }
          />
        ))}
        <Button
          label="Save correction"
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
        <Button
          label="Cancel"
          variant="ghost"
          isDisabled={pending}
          onClick={() => setOpen(false)}
        />
      </VStack>
    </Card>
  );
}
