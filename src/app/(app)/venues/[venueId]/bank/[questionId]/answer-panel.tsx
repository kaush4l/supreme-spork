"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { answerQuestion, dismissQuestion, makeRule } from "../actions";
import { afterQuestionHref } from "../next";

type Offer = { text: string; rows_that_would_change: number };

/**
 * Answer or set aside one question, then go on to the next open one. A rule is offered only when the API's answer
 * carries one, and is made only by pressing the button.
 */
export function AnswerPanel({
  venueId,
  questionId,
  status,
  kind,
  usualCategory,
  categories,
  ruleOffer,
}: {
  venueId: string;
  questionId: string;
  status: string;
  kind: string;
  usualCategory: string | null;
  categories: { value: string; label: string }[];
  ruleOffer: Offer | null;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [category, setCategory] = useState<string | undefined>(
    usualCategory && categories.some((c) => c.value === usualCategory)
      ? usualCategory
      : undefined,
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(ruleOffer);
  const [nextId, setNextId] = useState<string | null | undefined>(undefined);
  const [ruleDone, setRuleDone] = useState<string | null>(null);
  const isDocket = kind === "unmatched_docket";
  const go = (id: string | null) => router.push(afterQuestionHref(venueId, id));

  const answer = () =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await answerQuestion({
          venueId,
          questionId,
          key,
          ...(isDocket ? { note } : { category, note: note || undefined }),
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        if (result.data.ruleOffer) {
          setOffer(result.data.ruleOffer);
          setNextId(result.data.nextId);
        } else go(result.data.nextId);
      }),
    );

  const dismiss = () =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await dismissQuestion({
          venueId,
          questionId,
          key,
          note: note || undefined,
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        go(result.data.nextId);
      }),
    );

  const rule = () =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await makeRule({ venueId, questionId, key });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        setOffer(null);
        setRuleDone(
          result.data.alreadyMade
            ? "That rule was already made."
            : `Rule made. ${result.data.recategorised} waiting payments filed.`,
        );
      }),
    );

  if (offer || ruleDone) {
    return (
      <VStack gap={3} hAlign="stretch">
        {message ? <Banner status="error" title={message} /> : null}
        {ruleDone ? <Banner status="success" title={ruleDone} /> : null}
        {offer ? (
          <>
            <Text type="body">{offer.text}</Text>
            <Text type="supporting" color="secondary">
              {offer.rows_that_would_change} waiting payments would be filed.
            </Text>
            <Button
              label="Yes, make this rule"
              variant="primary"
              size="lg"
              isLoading={pending}
              onClick={rule}
            />
          </>
        ) : null}
        <Button
          label={offer ? "Not now, next question" : "Next question"}
          size="lg"
          onClick={() =>
            nextId === undefined
              ? router.push(`/venues/${venueId}/bank`)
              : go(nextId)
          }
        />
      </VStack>
    );
  }

  if (status !== "open") return null;

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {isDocket ? null : (
        <Selector
          label="What was it?"
          value={category}
          options={categories}
          onChange={setCategory}
          placeholder="Choose a category"
          hasSearch={categories.length > 8}
        />
      )}
      <TextInput
        label={isDocket ? "What happened to this docket?" : "Note"}
        description={
          isDocket ? "For example: on account, or paid cash." : undefined
        }
        value={note}
        onChange={setNote}
        isOptional={!isDocket}
        size="lg"
      />
      <HStack gap={2} wrap="wrap">
        <Button
          label="Save answer"
          variant="primary"
          size="lg"
          isLoading={pending}
          isDisabled={isDocket ? note.trim() === "" : !category}
          onClick={answer}
        />
        <Button
          label="Set aside"
          size="lg"
          isLoading={pending}
          onClick={dismiss}
        />
      </HStack>
    </VStack>
  );
}
