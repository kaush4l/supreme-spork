"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DraftShift } from "@/server/data/my-roster-drafts";
import { formatDay, formatHours, formatSpan } from "@/server/format";
import { useGuard } from "../../bills/guarded";
import { wallTime } from "../../timesheet/wall";
import { replyToDraft } from "./actions";
import { isSettled, replyWords, wallFrom } from "./words";

type Response = "accept" | "decline" | "propose" | "pickup";

/**
 * One shift of a draft roster with my answer and the buttons to change it. A key is made when it is drawn and replaced
 * only after a success, so a double tap or a retry sends one answer.
 */
export function DraftShiftCard({
  venueId,
  draftId,
  shift,
  timeZone,
  isOpenShift,
  mayPropose,
  mayPickUp,
}: {
  venueId: string;
  draftId: string;
  shift: DraftShift;
  timeZone: string;
  isOpenShift: boolean;
  mayPropose: boolean;
  mayPickUp: boolean;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<null | "decline" | "propose">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const wallStart = wallTime(shift.start, timeZone);
  const wallEnd = wallTime(shift.end, timeZone);
  const [startDay, setStartDay] = useState(wallStart.slice(0, 10));
  const [startTime, setStartTime] = useState(wallStart.slice(11));
  const [endDay, setEndDay] = useState(wallEnd.slice(0, 10));
  const [endTime, setEndTime] = useState(wallEnd.slice(11));

  const settled = isSettled(shift.reply);
  const words = replyWords(shift.reply, timeZone);

  const send = guard(async (response: Response) => {
    setMessage(null);
    let start: string | undefined;
    let end: string | undefined;
    if (response === "propose") {
      const s = wallFrom(startDay, startTime);
      const e = wallFrom(endDay, endTime);
      if (!s || !e)
        return setMessage(
          "Write the dates like 2026-11-16 and the times like 17:30.",
        );
      start = s;
      end = e;
    }
    setBusy(true);
    try {
      const result = await replyToDraft({
        venueId,
        draftId,
        externalId: shift.external_id,
        key,
        response,
        reason:
          response === "accept" || response === "pickup" ? undefined : reason,
        start,
        end,
      });
      if (!result.ok)
        return setMessage(result.error.message || "That did not work.");
      setKey(crypto.randomUUID());
      setForm(null);
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  });

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <Text type="body">
          {formatDay(shift.start, timeZone)},{" "}
          {formatSpan(shift.start, shift.end, timeZone)}
        </Text>
        <Text type="supporting" color="secondary">
          {[
            shift.position,
            shift.hours != null ? formatHours(shift.hours) : null,
            shift.break_minutes > 0 ? `${shift.break_minutes} min break` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {words ? <Text type="body">{words}</Text> : null}
        {isOpenShift && !shift.reply ? (
          <Text type="supporting" color="secondary">
            Nobody has this shift yet.
          </Text>
        ) : null}
        {message ? <Banner status="error" title={message} /> : null}
        {settled ? (
          <Text type="supporting" color="secondary">
            Your manager has decided this, so it cannot be changed here.
          </Text>
        ) : isOpenShift ? (
          mayPickUp && !shift.reply ? (
            <Button
              label="Pick this up"
              variant="primary"
              size="lg"
              isLoading={busy}
              onClick={() => send("pickup")}
            />
          ) : null
        ) : form === null ? (
          <VStack gap={2} hAlign="stretch">
            <Button
              label="Accept"
              variant="primary"
              size="lg"
              isLoading={busy}
              onClick={() => send("accept")}
            />
            {mayPropose ? (
              <Button
                label="Ask for a change"
                variant="secondary"
                size="lg"
                onClick={() => setForm("propose")}
              />
            ) : null}
            <Button
              label="I can't work it"
              variant="secondary"
              size="lg"
              onClick={() => setForm("decline")}
            />
          </VStack>
        ) : (
          <VStack gap={2} hAlign="stretch">
            {form === "propose" ? (
              <VStack gap={2} hAlign="stretch">
                <Text type="supporting" color="secondary">
                  Tell your manager the time you would rather work.
                </Text>
                <HStack gap={2}>
                  <TextInput
                    label="Start date"
                    value={startDay}
                    onChange={setStartDay}
                    placeholder="2026-11-16"
                  />
                  <TextInput
                    label="Start time"
                    value={startTime}
                    onChange={setStartTime}
                    placeholder="17:30"
                  />
                </HStack>
                <HStack gap={2}>
                  <TextInput
                    label="End date"
                    value={endDay}
                    onChange={setEndDay}
                    placeholder="2026-11-16"
                  />
                  <TextInput
                    label="End time"
                    value={endTime}
                    onChange={setEndTime}
                    placeholder="22:00"
                  />
                </HStack>
              </VStack>
            ) : null}
            <TextInput
              label="Reason (optional)"
              value={reason}
              onChange={setReason}
            />
            <Button
              label={form === "propose" ? "Send my request" : "Send my answer"}
              variant="primary"
              size="lg"
              isLoading={busy}
              onClick={() => send(form)}
            />
            <Button
              label="Back"
              variant="secondary"
              onClick={() => {
                setForm(null);
                setMessage(null);
              }}
            />
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
