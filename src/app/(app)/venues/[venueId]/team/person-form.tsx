"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { centsToInput, dollarsToCents } from "@/server/data/money-input";
import { addStaff, changeStaff } from "./actions";

export type PersonInitial = {
  staffId: string;
  name: string;
  email: string;
  positions: string[];
  rateCents: number | null;
};

/**
 * Add a person or edit one. The pay box exists only for someone holding the pay right (`canPay`, read from the rights
 * on the page); a rate left blank is not sent, so nobody changes pay by accident.
 */
export function PersonForm({
  venueId,
  positionNames,
  canPay,
  initial,
  onDone,
}: {
  venueId: string;
  positionNames: string[];
  canPay: boolean;
  initial?: PersonInitial;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [positions, setPositions] = useState<string[]>(
    initial?.positions ?? [],
  );
  const [rate, setRate] = useState(centsToInput(initial?.rateCents));
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      setMessage(null);
      setNotice(null);
      const parsed = canPay ? dollarsToCents(rate) : null;
      if (parsed === "invalid") {
        setMessage("Type the pay rate as dollars, for example 28.50.");
        return;
      }
      const rateChanged =
        parsed !== null &&
        (!initial || parsed !== (initial.rateCents ?? undefined));
      const send = (fields: {
        name?: string;
        email?: string;
        positionNames?: string[];
        hourlyCostCents?: number;
      }) =>
        initial
          ? changeStaff({
              venueId,
              key: crypto.randomUUID(),
              staffId: initial.staffId,
              ...fields,
            })
          : addStaff({
              venueId,
              key,
              name,
              email: email.trim() || undefined,
              positionNames: positions,
              hourlyCostCents: fields.hourlyCostCents,
            });
      const hourlyCostCents = rateChanged ? (parsed ?? undefined) : undefined;
      // Editing: other fields first (only what changed), then pay alone, because pay can wait for approval and the rest cannot.
      const othersChanged =
        !!initial &&
        (name !== initial.name ||
          email.trim() !== initial.email ||
          positions.join("\n") !== initial.positions.join("\n"));
      let result = await (initial &&
      !othersChanged &&
      hourlyCostCents !== undefined
        ? send({ hourlyCostCents })
        : send(
            initial
              ? {
                  name,
                  email: email.trim() || undefined,
                  positionNames: positions,
                }
              : { hourlyCostCents },
          ));
      if (
        initial &&
        othersChanged &&
        result.ok &&
        hourlyCostCents !== undefined
      )
        result = await send({ hourlyCostCents });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setKey(crypto.randomUUID());
      if (!initial) {
        setName("");
        setEmail("");
        setPositions([]);
        setRate("");
      }
      if ("needsApproval" in result.data && result.data.needsApproval)
        setNotice("Sent for approval. It changes once the owner approves it.");
      else onDone?.();
      router.refresh();
    });

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="info" title={notice} /> : null}
      <TextInput
        label="Name"
        value={name}
        onChange={setName}
        isRequired
        size="lg"
      />
      <TextInput
        label="Email"
        description="They need an email to be invited to sign in."
        type="email"
        value={email}
        onChange={setEmail}
        isOptional
        size="lg"
      />
      {canPay ? (
        <TextInput
          label="Pay rate per hour ($)"
          inputMode="decimal"
          value={rate}
          onChange={setRate}
          isOptional
          size="lg"
        />
      ) : null}
      <VStack gap={1}>
        <Text type="body">Positions</Text>
        {positionNames.length === 0 ? (
          <Text type="supporting" color="secondary">
            Add a position first (below) to give this person one.
          </Text>
        ) : (
          <HStack gap={4} wrap="wrap">
            {positionNames.map((p) => (
              <CheckboxInput
                key={p}
                label={p}
                value={positions.includes(p)}
                onChange={(checked: boolean) =>
                  setPositions((now) =>
                    checked ? [...now, p] : now.filter((x) => x !== p),
                  )
                }
              />
            ))}
          </HStack>
        )}
      </VStack>
      <Button
        label={initial ? "Save changes" : "Add person"}
        variant="primary"
        size="lg"
        isLoading={pending}
        isDisabled={name.trim() === ""}
        onClick={submit}
      />
    </VStack>
  );
}
