"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { keyInDocket } from "./actions";
import { LineFields } from "./line-fields";
import { type Errors, keyBody, type LineText } from "./payload";

/** `line` is only a unique key here: on screen the number is the position. */
let nextKey = 1;
const blank = (): LineText => ({
  line: nextKey++,
  description: "",
  qty: "",
  unitText: "",
  unitPrice: "",
  lineTotal: "",
  drop: false,
});

/** Type in a docket nobody has read, from its photo. Lines that do not add up are refused, with the reason by the line. */
export function KeyForm({
  venueId,
  documentId,
}: {
  venueId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [supplier, setSupplier] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [total, setTotal] = useState("");
  const [lines, setLines] = useState<LineText[]>([blank()]);
  const [errors, setErrors] = useState<Errors>({});

  const submit = () =>
    start(async () => {
      const built = keyBody({
        supplier,
        deliveryDate,
        invoiceNo,
        total,
        lines,
      });
      if (!built.ok) return setErrors(built.errors);
      setErrors({});
      const result = await keyInDocket({
        venueId,
        documentId,
        key,
        ...built.body,
      });
      if (!result.ok) {
        setErrors({
          form: result.error.message,
          ...(result.error.fields ?? {}),
        });
        return;
      }
      setKey(crypto.randomUUID());
      router.refresh();
    });

  const field = (name: string) =>
    errors[name]
      ? ({ type: "error", message: errors[name] } as const)
      : undefined;
  const boxes = new Set(["delivery_date", "total_cents"]);
  const loose = Object.entries(errors)
    .filter(([k]) => !boxes.has(k) && !k.startsWith("lines["))
    .map(([, m]) => m);

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Type this docket in</Heading>
        <Text type="supporting" color="secondary">
          Copy each line from the photo. If the lines do not add up, you will
          see which one to check.
        </Text>
        {[...new Set(loose)].map((m) => (
          <Banner key={m} status="error" title={m} />
        ))}
        <TextInput label="Supplier" value={supplier} onChange={setSupplier} />
        <TextInput
          label="Delivery date"
          value={deliveryDate}
          onChange={setDeliveryDate}
          placeholder="2026-11-03"
          isRequired
          status={field("delivery_date")}
        />
        <TextInput
          label="Invoice number"
          value={invoiceNo}
          onChange={setInvoiceNo}
          isOptional
        />
        <TextInput
          label="Docket total ($)"
          value={total}
          onChange={setTotal}
          inputMode="decimal"
          isOptional
          status={field("total_cents")}
        />
        {lines.map((l, i) => (
          <LineFields
            key={l.line}
            n={i + 1}
            text={l}
            errors={errors}
            showUnit
            onChange={(next) =>
              setLines((all) => all.map((x, j) => (j === i ? next : x)))
            }
            onRemove={
              lines.length > 1
                ? () => setLines((all) => all.filter((_, j) => j !== i))
                : undefined
            }
          />
        ))}
        <Button
          label="Add a line"
          isDisabled={pending}
          onClick={() => setLines((all) => [...all, blank()])}
        />
        <Button
          label="Save docket"
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
      </VStack>
    </Card>
  );
}
