"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DateInput } from "@astryxdesign/core/DateInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { type ComponentProps, useRef, useState, useTransition } from "react";
import {
  CERTIFICATE_KINDS,
  type CertificateKind,
} from "@/server/data/person-text";
import { removeCertificate, saveCertificate } from "./actions";

type Day = ComponentProps<typeof DateInput>["value"];
type Row = {
  kind: string;
  kindLabel: string;
  number: string | null;
  expiresOn: string;
  expiresLabel: string;
  sourceLabel: string;
};

/** The list, the add-or-correct form, and the remove question. One current certificate per kind. */
export function Certificates({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const [kind, setKind] = useState<CertificateKind>("rsa");
  const [number, setNumber] = useState("");
  const [expires, setExpires] = useState<Day>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);

  const holds = rows.some((r) => r.kind === kind);

  const edit = (row: Row) => {
    setKind(row.kind as CertificateKind);
    setNumber(row.number ?? "");
    setExpires(row.expiresOn as Day);
    setMessage(null);
    setNotice(null);
  };

  const submit = () => {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        setMessage(null);
        setNotice(null);
        if (!expires) {
          setMessage("Choose the day it expires.");
          return;
        }
        const result = await saveCertificate({
          key,
          kind,
          expiresOn: String(expires),
          number: number.trim() === "" ? null : number.trim(),
        });
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        setKey(crypto.randomUUID());
        setNotice("Certificate saved.");
        setNumber("");
        setExpires(undefined);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  const confirmRemove = () => {
    if (!removing || busy.current) return;
    busy.current = true;
    const row = removing;
    start(async () => {
      try {
        const result = await removeCertificate({
          kind: row.kind as CertificateKind,
        });
        setRemoving(null);
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        setNotice("Certificate removed.");
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <VStack gap={4} hAlign="stretch">
      {rows.length === 0 ? (
        <Text type="body">You have not added a certificate yet.</Text>
      ) : (
        <VStack gap={2} hAlign="stretch">
          {rows.map((row) => (
            <Card key={row.kind} padding={4}>
              <VStack gap={2}>
                <Heading level={2}>{row.kindLabel}</Heading>
                <Text type="supporting" color="secondary">
                  {row.number ? `Number ${row.number}` : "No number"}
                </Text>
                <Text type="supporting" color="secondary">
                  Expires {row.expiresLabel}
                </Text>
                <Text type="supporting" color="secondary">
                  {row.sourceLabel}
                </Text>
                <HStack gap={2} wrap="wrap">
                  <Button label="Correct" onClick={() => edit(row)} />
                  <Button
                    label="Remove"
                    variant="destructive"
                    onClick={() => setRemoving(row)}
                  />
                </HStack>
              </VStack>
            </Card>
          ))}
        </VStack>
      )}

      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Add or correct a certificate</Heading>
          {message ? <Banner status="error" title={message} /> : null}
          {notice ? <Banner status="success" title={notice} /> : null}
          <Selector
            label="Kind"
            value={kind}
            options={CERTIFICATE_KINDS.map((k) => ({
              value: k.value,
              label: k.label,
            }))}
            onChange={(v) => setKind(v as CertificateKind)}
          />
          {holds ? (
            <Text type="supporting" color="secondary">
              You already have one of this kind. Saving replaces it.
            </Text>
          ) : null}
          <TextInput
            label="Number"
            value={number}
            onChange={setNumber}
            isOptional
            size="lg"
          />
          <DateInput label="Expires on" value={expires} onChange={setExpires} />
          <Button
            label={holds ? "Save correction" : "Add certificate"}
            variant="primary"
            size="lg"
            isLoading={pending}
            onClick={submit}
          />
        </VStack>
      </Card>

      <AlertDialog
        isOpen={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove your ${removing?.kindLabel ?? ""} certificate?`}
        description="It is taken off your profile. A venue will not copy it back in. You can add it again later."
        actionLabel="Remove"
        actionVariant="destructive"
        isActionLoading={pending}
        onAction={confirmRemove}
      />
    </VStack>
  );
}
