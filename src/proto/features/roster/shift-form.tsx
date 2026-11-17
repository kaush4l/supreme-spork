"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { useState } from "react";
import type { ShiftRecord } from "../../types";
import {
  composeTimes,
  fmtDayLong,
  shiftWithDates,
  splitWall,
  timeOptions,
  weekDays,
} from "./dates";
import type { ShiftInput } from "./draft";
import { StaffPicker, staffRole } from "./staff-picker";

const ROLES = [
  "Barista",
  "Bartender",
  "Chef",
  "Cook",
  "Host",
  "Kitchen hand",
  "Supervisor",
  "Waiter",
];
const TIMES = timeOptions();

export interface ShiftFormProps {
  open: boolean;
  /** Full-screen on phone, dialog on desktop. */
  desktop: boolean;
  shift: ShiftRecord | null;
  weekStart: string;
  defaultDay: string;
  venueName: string;
  onSave: (input: ShiftInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function FormBody({
  shift,
  weekStart,
  defaultDay,
  venueName,
  onSave,
  onDelete,
  onClose,
}: Omit<ShiftFormProps, "open" | "desktop">) {
  const a = shift ? splitWall(shift.start) : null;
  const b = shift ? splitWall(shift.end) : null;
  const [staffId, setStaffId] = useState<string | null>(
    shift ? shift.staffId : null,
  );
  const [role, setRole] = useState(shift?.role ?? "Waiter");
  const [startDay, setStartDay] = useState(a?.date ?? defaultDay);
  const [startTime, setStartTime] = useState(a?.time ?? "09:00");
  const [endTime, setEndTime] = useState(b?.time ?? "17:00");
  const [nextDay, setNextDay] = useState(!!(a && b && b.date > a.date));
  const [leave, setLeave] = useState(!!shift?.leave);
  const [error, setError] = useState<string | null>(null);

  const times = composeTimes({ startDay, startTime, endTime, nextDay });
  const sameDayBackwards = !nextDay && endTime <= startTime;

  const save = () => {
    if (leave && !staffId) {
      setError("Leave needs a person. Pick a staff member or untick leave.");
      return;
    }
    setError(null);
    onSave({
      staffId,
      role,
      start: times.start,
      end: times.end,
      ...(leave ? { leave: true } : {}),
    });
  };

  return (
    <VStack gap={3} padding={4} hAlign="stretch">
      <Text type="supporting" as="p">
        {venueName}. Times are venue time.
      </Text>
      <StaffPicker
        value={staffId}
        onChange={(id) => {
          setStaffId(id);
          const r = staffRole(id);
          if (r && !shift) setRole(r);
        }}
      />
      <Selector
        label="Role"
        value={role}
        options={ROLES}
        onChange={setRole}
        width="100%"
      />
      <Selector
        label="Start day"
        value={startDay}
        options={weekDays(weekStart).map((d) => ({
          value: d,
          label: fmtDayLong(d),
        }))}
        onChange={setStartDay}
        width="100%"
      />
      <HStack gap={3} wrap="wrap" vAlign="start">
        <Selector
          label="Start time"
          value={startTime}
          options={TIMES}
          onChange={setStartTime}
          width={180}
        />
        <Selector
          label="End time"
          value={endTime}
          options={TIMES}
          onChange={setEndTime}
          width={180}
        />
      </HStack>
      <CheckboxInput
        label="Ends the next day (overnight shift)"
        value={nextDay}
        onChange={setNextDay}
      />
      <CheckboxInput
        label="This is leave, not a working shift"
        value={leave}
        onChange={setLeave}
      />
      <Text as="p" aria-live="polite">
        {`This shift: ${shiftWithDates(times)}${nextDay ? " (overnight)" : ""}`}
      </Text>
      {sameDayBackwards && (
        <Banner
          status="warning"
          title="End is not after start"
          description="Publishing will report a blocking error unless you tick 'Ends the next day' for an overnight shift."
          collapsible={false}
        />
      )}
      {error && (
        <Banner
          status="error"
          title="Fix this before saving"
          description={error}
          collapsible={false}
        />
      )}
      <HStack gap={2} wrap="wrap">
        <Button label="Save shift to draft" variant="primary" onClick={save} />
        <Button label="Cancel" onClick={onClose} />
        {onDelete && (
          <Button
            label="Remove shift from draft"
            variant="destructive"
            onClick={onDelete}
          />
        )}
      </HStack>
    </VStack>
  );
}

/** Accessible shift editor: full-screen on phone, dialog on desktop. Remounts its fields on every open. */
export function ShiftForm(props: ShiftFormProps) {
  const { open, desktop, shift, onClose } = props;
  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      purpose="form"
      variant={desktop ? "standard" : "fullscreen"}
      width={desktop ? 600 : undefined}
      maxHeight={desktop ? "90dvh" : undefined}
    >
      <DialogHeader
        title={shift ? "Edit shift" : "Add shift"}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      />
      {open && <FormBody key={shift?.id ?? "new"} {...props} />}
    </Dialog>
  );
}
