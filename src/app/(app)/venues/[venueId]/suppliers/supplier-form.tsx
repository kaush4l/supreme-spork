"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeSupplier } from "./[supplierId]/actions";
import { addSupplier } from "./actions";
import { aliasesText, parseAliases } from "./aliases";

export type SupplierInitial = {
  id: string;
  name: string;
  aliases: string[];
  category: string | null;
  paymentTermsDays: number | null;
  provisional: boolean;
};

/** Add a supplier, or edit one (then `initial` is set). The backend decides who may; the page only shows this to those who can. */
export function SupplierForm({
  venueId,
  initial,
}: {
  venueId: string;
  initial?: SupplierInitial;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [aliases, setAliases] = useState(aliasesText(initial?.aliases ?? []));
  const [category, setCategory] = useState(initial?.category ?? "");
  const [terms, setTerms] = useState(
    initial?.paymentTermsDays === null || initial === undefined
      ? ""
      : String(initial.paymentTermsDays),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const submit = () =>
    start(async () => {
      setMessage(null);
      setChanged(false);
      const days = terms.trim() === "" ? null : Number(terms.trim());
      if (
        days !== null &&
        !(Number.isInteger(days) && days >= 0 && days <= 365)
      ) {
        setMessage("Payment terms are a number of days from 0 to 365.");
        return;
      }
      const result = initial
        ? await changeSupplier({
            venueId,
            supplierId: initial.id,
            key,
            name,
            aliases: parseAliases(aliases),
            category: category.trim() || null,
            paymentTermsDays: days,
            confirmed: initial.provisional ? true : undefined,
          })
        : await addSupplier({
            venueId,
            key,
            name,
            aliases: parseAliases(aliases),
            category: category.trim() || undefined,
            paymentTermsDays: days ?? undefined,
          });
      if (!result.ok) {
        setMessage(result.error.message);
        setChanged(result.error.code === "supplier_changed");
        return;
      }
      setKey(crypto.randomUUID());
      if (initial) {
        router.push(`/venues/${venueId}/suppliers/${result.data.id}`);
      } else {
        setName("");
        setAliases("");
        setCategory("");
        setTerms("");
        router.push(`/venues/${venueId}/suppliers/${result.data.id}`);
      }
      router.refresh();
    });

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {changed ? (
        <HStack gap={2}>
          <Button
            label="Reload this supplier"
            onClick={() => router.refresh()}
          />
        </HStack>
      ) : null}
      <TextInput
        label="Name"
        value={name}
        onChange={setName}
        isRequired
        size="lg"
      />
      <TextArea
        label="Other spellings on dockets"
        description="One per line, for example Harbour Fish."
        isOptional
        value={aliases}
        onChange={(v) => setAliases(v)}
      />
      <TextInput
        label="Category"
        value={category}
        onChange={setCategory}
        isOptional
        size="lg"
      />
      <TextInput
        label="Payment terms (days after delivery)"
        value={terms}
        onChange={setTerms}
        inputMode="numeric"
        isOptional
        size="lg"
      />
      <HStack gap={2}>
        <Button
          label={initial ? "Save changes" : "Add supplier"}
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
      </HStack>
    </VStack>
  );
}
