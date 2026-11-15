"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../bills/guarded";
import { changeRule, createRule, deactivateRule } from "./actions";

type Option = { value: string; label: string };

export type RuleView = {
  targetKind: string;
  position: string;
  personName: string | null;
  timingKind: string;
  offset: number | null;
  fixedTime: string | null;
};

export function RuleRow({
  venueId,
  ruleKey,
  text,
  rule,
  positions,
  staff,
}: {
  venueId: string;
  ruleKey: string;
  text: string;
  rule: RuleView;
  positions: Option[];
  staff: Option[];
}) {
  const router = useRouter();
  const guard = useGuard();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [targetKind, setTargetKind] = useState(rule.targetKind);
  const [position, setPosition] = useState(rule.position);
  const [staffId, setStaffId] = useState("");
  const [timingKind, setTimingKind] = useState(rule.timingKind);
  const [offset, setOffset] = useState(
    rule.offset === null ? "30" : String(rule.offset),
  );
  const [fixedTime, setFixedTime] = useState(rule.fixedTime ?? "");
  const stop = () =>
    start(async () => {
      const result = await deactivateRule({ venueId, ruleKey });
      if (!result.ok) return setMessage(result.error.message);
      router.refresh();
    });
  const save = guard(
    () =>
      new Promise<void>((resolve) =>
        start(async () => {
          const result = await changeRule({
            venueId,
            ruleKey,
            targetKind: targetKind as "everyone" | "position" | "person",
            position: position || undefined,
            staffId: staffId || undefined,
            timingKind: timingKind as
              | "shift_start"
              | "before_shift_end"
              | "fixed_time",
            offsetMinutes: offset.trim() ? Number(offset) : undefined,
            fixedTime: fixedTime || undefined,
          });
          if (!result.ok) setMessage(result.error.message);
          else {
            setMessage(null);
            setOpen(false);
            router.refresh();
          }
          resolve();
        }),
      ),
  );
  return (
    <VStack gap={2} hAlign="start">
      <Text type="body">{text}</Text>
      {open ? (
        <VStack gap={2} hAlign="stretch">
          <Selector
            label="Given to"
            options={[
              { value: "everyone", label: "Everyone on a shift" },
              { value: "position", label: "One position" },
              { value: "person", label: "One person" },
            ]}
            value={targetKind}
            onChange={setTargetKind}
          />
          {targetKind === "position" ? (
            <Selector
              label="Position"
              options={positions}
              value={position}
              onChange={setPosition}
            />
          ) : null}
          {targetKind === "person" ? (
            <Selector
              label="Person"
              options={staff}
              value={staffId}
              onChange={setStaffId}
              hasSearch
              description={
                rule.personName
                  ? `Leave it to keep ${rule.personName}.`
                  : undefined
              }
            />
          ) : null}
          <Selector
            label="Due"
            options={[
              { value: "shift_start", label: "When the shift starts" },
              { value: "before_shift_end", label: "Before the shift ends" },
              { value: "fixed_time", label: "At a set time" },
            ]}
            value={timingKind}
            onChange={setTimingKind}
          />
          {timingKind === "before_shift_end" ? (
            <TextInput
              label="Minutes before the end"
              value={offset}
              onChange={setOffset}
              inputMode="numeric"
            />
          ) : null}
          {timingKind === "fixed_time" ? (
            <TextInput
              label="Time (venue time)"
              value={fixedTime}
              onChange={setFixedTime}
              placeholder="17:30"
            />
          ) : null}
        </VStack>
      ) : null}
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2}>
        {open ? (
          <>
            <Button
              label="Save rule"
              size="sm"
              variant="primary"
              isLoading={pending}
              onClick={save}
            />
            <Button label="Cancel" size="sm" onClick={() => setOpen(false)} />
          </>
        ) : (
          <>
            <Button
              label="Change this rule"
              size="sm"
              onClick={() => {
                setTargetKind(rule.targetKind);
                setPosition(rule.position);
                setStaffId("");
                setTimingKind(rule.timingKind);
                setOffset(rule.offset === null ? "30" : String(rule.offset));
                setFixedTime(rule.fixedTime ?? "");
                setMessage(null);
                setOpen(true);
              }}
            />
            <Button
              label="Stop this rule"
              size="sm"
              isLoading={pending}
              onClick={stop}
            />
          </>
        )}
      </HStack>
    </VStack>
  );
}

export function RuleForm({
  venueId,
  templates,
  positions,
  staff,
}: {
  venueId: string;
  templates: Option[];
  positions: Option[];
  staff: Option[];
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [templateKey, setTemplateKey] = useState("");
  const [targetKind, setTargetKind] = useState("everyone");
  const [position, setPosition] = useState("");
  const [staffId, setStaffId] = useState("");
  const [timingKind, setTimingKind] = useState("shift_start");
  const [offset, setOffset] = useState("30");
  const [fixedTime, setFixedTime] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      if (!templateKey) return setMessage("Choose a checklist.");
      const result = await createRule({
        venueId,
        key,
        templateKey,
        targetKind: targetKind as "everyone" | "position" | "person",
        position: position || undefined,
        staffId: staffId || undefined,
        timingKind: timingKind as
          | "shift_start"
          | "before_shift_end"
          | "fixed_time",
        offsetMinutes: offset.trim() ? Number(offset) : undefined,
        fixedTime: fixedTime || undefined,
      });
      if (!result.ok) return setMessage(result.error.message);
      setMessage(null);
      setKey(crypto.randomUUID());
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Add a rule</Heading>
        <Selector
          label="Checklist"
          options={templates}
          value={templateKey}
          onChange={setTemplateKey}
        />
        <Selector
          label="Given to"
          options={[
            { value: "everyone", label: "Everyone on a shift" },
            { value: "position", label: "One position" },
            { value: "person", label: "One person" },
          ]}
          value={targetKind}
          onChange={setTargetKind}
        />
        {targetKind === "position" ? (
          <Selector
            label="Position"
            options={positions}
            value={position}
            onChange={setPosition}
          />
        ) : null}
        {targetKind === "person" ? (
          <Selector
            label="Person"
            options={staff}
            value={staffId}
            onChange={setStaffId}
            hasSearch
          />
        ) : null}
        <Selector
          label="Due"
          options={[
            { value: "shift_start", label: "When the shift starts" },
            { value: "before_shift_end", label: "Before the shift ends" },
            { value: "fixed_time", label: "At a set time" },
          ]}
          value={timingKind}
          onChange={setTimingKind}
        />
        {timingKind === "before_shift_end" ? (
          <TextInput
            label="Minutes before the end"
            value={offset}
            onChange={setOffset}
            inputMode="numeric"
          />
        ) : null}
        {timingKind === "fixed_time" ? (
          <TextInput
            label="Time (venue time)"
            value={fixedTime}
            onChange={setFixedTime}
            placeholder="17:30"
          />
        ) : null}
        {message ? <Banner status="error" title={message} /> : null}
        <Button
          label="Add rule"
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
      </VStack>
    </Card>
  );
}
