"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Certificate } from "@/server/data/team-extras";
import { useGuard } from "../../bills/guarded";
import { checkCertificate, recordCertificate } from "./actions";

const KIND_WORDS: Record<string, string> = {
  rsa: "RSA",
  food_safety: "Food safety",
  first_aid: "First aid",
  other: "Other",
};
const KINDS = Object.entries(KIND_WORDS).map(([value, label]) => ({
  value,
  label,
}));
const STATUS: Record<
  string,
  {
    label: string;
    help: string;
    variant: "success" | "warning" | "neutral" | "info";
  }
> = {
  checked: {
    label: "Checked",
    help: "You checked their current certificate.",
    variant: "success",
  },
  changed: {
    label: "Changed since checked",
    help: "They changed their certificate after you checked it. Check it again.",
    variant: "warning",
  },
  unchecked: {
    label: "Not checked yet",
    help: "Nobody has checked this one.",
    variant: "warning",
  },
  venue_only: {
    label: "Only on your file",
    help: "Only the venue holds it. The person has not added their own.",
    variant: "neutral",
  },
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function side(s: { number: string | null; expires_on: string } | null) {
  return s ? `${s.number ? `${s.number}, ` : ""}ends ${s.expires_on}` : null;
}

export function CertificatesCard({
  venueId,
  staffId,
  items,
}: {
  venueId: string;
  staffId: string;
  items: Certificate[];
}) {
  const router = useRouter();
  const guard = useGuard();
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState("rsa");
  const [expires, setExpires] = useState("");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = guard(
    async (
      send: () => Promise<{
        ok: boolean;
        data?: unknown;
        error?: { message: string };
      }>,
      success: string,
    ) => {
      setMessage(null);
      setNotice(null);
      setPending(true);
      const result = await send();
      setPending(false);
      if (!result.ok)
        return setMessage(result.error?.message ?? "That did not work.");
      const waiting = (result.data as { needsApproval?: boolean } | undefined)
        ?.needsApproval;
      setNotice(
        waiting
          ? "Sent for approval. Nothing changes until it is approved."
          : success,
      );
      router.refresh();
    },
  );

  const save = () => {
    if (!DAY.test(expires))
      return setMessage("Write the end date like 2027-06-30.");
    return run(
      () =>
        recordCertificate({
          venueId,
          staffId,
          kind: kind as "rsa",
          expiresOn: expires,
          number,
        }),
      "Certificate saved.",
    );
  };

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Certificates</Heading>
        {items.length === 0 ? (
          <Text type="supporting" color="secondary">
            No certificates on file.
          </Text>
        ) : (
          items.map((c) => {
            const s = STATUS[c.status] ?? {
              label: c.status,
              help: "",
              variant: "neutral" as const,
            };
            return (
              <VStack key={c.kind} gap={1} hAlign="stretch">
                <HStack gap={2} wrap="wrap">
                  <Text type="body">{KIND_WORDS[c.kind] ?? c.kind}</Text>
                  <Badge label={s.label} variant={s.variant} />
                </HStack>
                <Text type="supporting" color="secondary">
                  {s.help}
                </Text>
                {c.venue ? (
                  <Text type="supporting" color="secondary">
                    Your file: {side(c.venue)}
                  </Text>
                ) : null}
                {c.person ? (
                  <Text type="supporting" color="secondary">
                    Their own: {side(c.person)}
                  </Text>
                ) : null}
                <HStack gap={2} wrap="wrap">
                  <Button
                    label="Correct"
                    aria-label={`Correct ${KIND_WORDS[c.kind] ?? c.kind}`}
                    onClick={() => {
                      setKind(c.kind);
                      setExpires((c.venue ?? c.person)?.expires_on ?? "");
                      setNumber((c.venue ?? c.person)?.number ?? "");
                    }}
                  />
                  {c.person && c.status !== "checked" ? (
                    <Button
                      label="I have checked this"
                      aria-label={`I have checked ${KIND_WORDS[c.kind] ?? c.kind}`}
                      isDisabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            checkCertificate({
                              venueId,
                              staffId,
                              kind: c.kind as "rsa",
                            }),
                          "Marked as checked.",
                        )
                      }
                    />
                  ) : null}
                </HStack>
              </VStack>
            );
          })
        )}
        {message ? <Banner status="error" title={message} /> : null}
        {notice ? <Banner status="success" title={notice} /> : null}
        <Heading level={3}>Record or correct a certificate</Heading>
        <Selector
          label="Kind"
          options={KINDS}
          value={kind}
          onChange={setKind}
        />
        <TextInput
          label="Ends on"
          value={expires}
          onChange={setExpires}
          placeholder="2027-06-30"
        />
        <TextInput
          label="Number"
          value={number}
          onChange={setNumber}
          isOptional
        />
        <Button
          label="Save certificate"
          variant="primary"
          isLoading={pending}
          onClick={save}
        />
      </VStack>
    </Card>
  );
}
