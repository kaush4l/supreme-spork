"use client";

import { Button } from "@astryxdesign/core/Button";
import { FileInput } from "@astryxdesign/core/FileInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useState } from "react";
import { StatusFeedback } from "../../components/section";
import {
  type StaffToday as StaffData,
  type StaffDay,
  type SummaryItem,
  staffToday,
} from "../../fixtures/home";
import { useProto, useProtoSlice } from "../../state/store";
import { fmtShiftRange } from "./format";
import {
  ACTION_LABEL,
  addUpload,
  applyClock,
  type ClockAction,
  completeItem,
  EMPTY_LOCAL,
  type StaffLocal,
} from "./staff-actions";
import {
  type DataOf,
  EmptyNote,
  type HomeCtx,
  hrefFor,
  PageTitle,
  Sec,
  StaleBanner,
} from "./ui";
import { useSections } from "./use-sections";
import { useSimAction } from "./use-sim-action";

/** After an action removes the control that was pressed, focus moves to a stable status region, not <body>. */
function focusSoon(id: string) {
  setTimeout(() => document.getElementById(id)?.focus(), 50);
}

export const DAY_OPTIONS: { value: StaffDay; label: string }[] = [
  { value: "normal", label: "Normal day" },
  { value: "missing_clock_out", label: "Missing clock-out" },
  { value: "overnight", label: "Overnight shift" },
  { value: "no_work", label: "No work today" },
  { value: "late_finish", label: "Late finish" },
];

type ShiftData = DataOf<StaffData["shifts"]>;
const STATE_WORD: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  missing_clock_out: "Missing clock-out",
  done: "Done",
};

function ShiftLine({
  heading,
  shift,
}: {
  heading: string;
  shift: NonNullable<ShiftData["currentShift"]>;
}) {
  return (
    <VStack gap={0} hAlign="start">
      <Text type="supporting">{heading}</Text>
      <Text weight="semibold">{fmtShiftRange(shift.start, shift.end)}</Text>
      <Text type="supporting">
        {shift.role} · {STATE_WORD[shift.state]}
        {shift.overnight ? " · Overnight" : ""}
      </Text>
    </VStack>
  );
}

export function StaffTodayView({ ctx }: { ctx: HomeCtx }) {
  const { venueId } = useProto();
  const [day, setDay] = useProtoSlice<StaffDay>("homes:staffDay", "normal");
  const s = useSections("staff", staffToday, day);
  const [local, setLocal] = useProtoSlice<StaffLocal>(
    `homes:staff:${venueId}:${day}`,
    EMPTY_LOCAL,
  );
  const act = useSimAction();
  const [reportTime, setReportTime] = useState("5:00 pm");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  // Scenario 'denied' removes upload rights; read the flag from the fixture (not a section).
  const uploadAllowed = staffToday(
    venueId,
    s.scenario,
    day,
  ).docketUploadAllowed;

  const clockNow = (data: ShiftData) => local.clock ?? data.clock;

  const doClock = (action: ClockAction) =>
    act
      .run(
        `clock:${action}`,
        {
          pending:
            action === "clock_in"
              ? "Clocking in"
              : action === "clock_out"
                ? "Clocking out"
                : "Sending your report",
          success:
            action === "clock_in"
              ? "You are clocked in (simulated)."
              : action === "clock_out"
                ? "You are clocked out (simulated)."
                : "Missing clock-out reported (simulated).",
        },
        () => {
          const c = applyClock(action, reportTime);
          if (c)
            setLocal((l) => ({
              ...l,
              clock: c,
              reported:
                action === "report_missing_clock_out" ? reportTime : l.reported,
            }));
        },
      )
      .then((r) => {
        if (r === "success") focusSoon("staff-clock-status");
      });

  const submitUpload = () => {
    if (!file) {
      setFileError("Choose a docket file first.");
      return;
    }
    setFileError(null);
    const name = file.name;
    void act
      .run(
        "upload",
        {
          pending: `Uploading ${name}`,
          success: `${name} was sent for review (simulated, nothing was read).`,
        },
        () => setLocal((l) => addUpload(l, name, note)),
      )
      .then((r) => {
        if (r === "success") {
          setFile(null);
          setNote("");
        }
      });
  };

  return (
    <VStack gap={5} hAlign="stretch">
      <PageTitle title="Today" sub="Tue 17 Nov" />
      <StaleBanner show={s.scenario === "stale"} />

      <VStack
        gap={1}
        hAlign="stretch"
        role="group"
        aria-label="Day variant (prototype control)"
      >
        <Text type="supporting">Prototype day variant</Text>
        <HStack gap={1} wrap="wrap">
          {DAY_OPTIONS.map((o) => (
            <Button
              key={o.value}
              label={o.label}
              size="sm"
              variant={day === o.value ? "primary" : "secondary"}
              aria-pressed={day === o.value}
              onClick={() => setDay(o.value)}
              style={{ minBlockSize: "2.75rem" }}
            />
          ))}
        </HStack>
      </VStack>

      <StatusFeedback
        status={act.fb.status}
        message={act.fb.message}
        onDismiss={act.clear}
      />

      <Sec
        title="Your shift"
        result={s.get<ShiftData>("shifts")}
        onRetry={() => s.retry("shifts")}
      >
        {(d) => {
          const clock = clockNow(d);
          return (
            <VStack gap={3} hAlign="stretch">
              {d.noWorkToday && <Text weight="semibold">No work today.</Text>}
              {d.currentShift && (
                <ShiftLine heading="Current shift" shift={d.currentShift} />
              )}
              {d.nextShift && (
                <ShiftLine heading="Next shift" shift={d.nextShift} />
              )}
              {d.lateFinish && (
                <Text type="supporting">
                  This shift ran past its scheduled end.
                </Text>
              )}
              <VStack
                id="staff-clock-status"
                tabIndex={-1}
                gap={0}
                hAlign="start"
              >
                <Text data-testid="clock-message">{clock.message}</Text>
              </VStack>
              {clock.action === "report_missing_clock_out" && (
                <TextInput
                  label="Time you finished"
                  description="Your manager confirms this time."
                  value={reportTime}
                  onChange={(v) => setReportTime(v)}
                />
              )}
              {clock.action !== "none" && (
                <HStack gap={2}>
                  <Button
                    label={ACTION_LABEL[clock.action]}
                    variant="primary"
                    isLoading={act.busyName === `clock:${clock.action}`}
                    onClick={() => doClock(clock.action)}
                    style={{ minBlockSize: "2.75rem" }}
                  />
                </HStack>
              )}
            </VStack>
          );
        }}
      </Sec>

      <Sec
        title="Checklist due"
        result={s.get<{ items: SummaryItem[] }>("dueChecklist")}
        onRetry={() => s.retry("dueChecklist")}
      >
        {(d) =>
          d.items.length === 0 ? (
            <EmptyNote>Nothing due right now.</EmptyNote>
          ) : (
            <VStack gap={2} hAlign="stretch">
              {d.items.map((i) => {
                const done = local.done.includes(i.id);
                return (
                  <VStack
                    key={i.id}
                    id={`check-row-${i.id}`}
                    tabIndex={-1}
                    gap={0}
                    hAlign="stretch"
                  >
                    <HStack
                      key={i.id}
                      gap={2}
                      wrap="wrap"
                      vAlign="center"
                      justify="between"
                    >
                      <VStack gap={0} hAlign="start">
                        <Text>{i.label}</Text>
                        <Text type="supporting">
                          {done ? "Done" : i.detail}
                        </Text>
                      </VStack>
                      {!done && (
                        <Button
                          label={`Complete ${i.label}`}
                          isLoading={act.busyName === `check:${i.id}`}
                          onClick={() =>
                            act
                              .run(
                                `check:${i.id}`,
                                {
                                  pending: `Completing ${i.label}`,
                                  success: `${i.label} completed (simulated).`,
                                },
                                () => setLocal((l) => completeItem(l, i.id)),
                              )
                              .then((r) => {
                                if (r === "success")
                                  focusSoon(`check-row-${i.id}`);
                              })
                          }
                          style={{ minBlockSize: "2.75rem" }}
                        />
                      )}
                    </HStack>
                  </VStack>
                );
              })}
            </VStack>
          )
        }
      </Sec>

      <Sec
        title="Responses"
        result={s.get<{ items: SummaryItem[] }>("responses")}
        onRetry={() => s.retry("responses")}
        rows={2}
      >
        {(d) =>
          d.items.length === 0 ? (
            <EmptyNote>No responses waiting.</EmptyNote>
          ) : (
            <List hasDividers edge="flush">
              {d.items.map((i) => (
                <ListItem
                  key={i.id}
                  href={hrefFor(ctx, i.href)}
                  label={<Text>{i.label}</Text>}
                  description={
                    i.detail ? (
                      <Text type="supporting">{i.detail}</Text>
                    ) : undefined
                  }
                />
              ))}
            </List>
          )
        }
      </Sec>

      <VStack
        gap={2}
        hAlign="stretch"
        as="section"
        aria-label="Upload a docket"
      >
        <Text type="large" weight="semibold" as="p">
          Upload a docket
        </Text>
        {uploadAllowed ? (
          <>
            <FileInput
              label="Docket file"
              description="Only the file name is used in this prototype."
              value={file}
              onChange={(f) => {
                setFile(Array.isArray(f) ? (f[0] ?? null) : f);
                setFileError(null);
              }}
              accept="image/*,.pdf"
              status={
                fileError ? { type: "error", message: fileError } : undefined
              }
            />
            <TextInput
              label="Note (optional)"
              value={note}
              onChange={(v) => setNote(v)}
            />
            <HStack gap={2}>
              <Button
                label="Send docket"
                variant="primary"
                isLoading={act.busyName === "upload"}
                onClick={submitUpload}
                style={{ minBlockSize: "2.75rem" }}
              />
            </HStack>
            {local.uploads.length > 0 && (
              <List edge="flush">
                {local.uploads.map((u) => (
                  <ListItem
                    key={u.id}
                    label={<Text>{u.name}</Text>}
                    description={
                      <Text type="supporting">
                        Sent for review{u.note ? ` · ${u.note}` : ""}
                      </Text>
                    }
                  />
                ))}
              </List>
            )}
          </>
        ) : (
          <EmptyNote>Docket upload is not available for your access.</EmptyNote>
        )}
      </VStack>
    </VStack>
  );
}
