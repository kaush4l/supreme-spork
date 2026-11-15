"use client";

import { DateInput } from "@astryxdesign/core/DateInput";
import { Selector } from "@astryxdesign/core/Selector";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useTransition } from "react";

type Value = ComponentProps<typeof DateInput>["value"];

/** Pick one of the weeks that have findings; the address carries the choice. */
export function WeekPicker({
  venueId,
  weeks,
  value,
  day,
}: {
  venueId: string;
  weeks: { week_start: string; count: number }[];
  value: string | undefined;
  day: string | undefined;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = weeks.map((w) => ({
    value: w.week_start,
    label: `Week starting ${w.week_start} (${w.count})`,
  }));
  if (value && !weeks.some((w) => w.week_start === value))
    options.unshift({
      value,
      label: `Week starting ${value} (none)`,
    });
  return (
    <Selector
      label="Week"
      value={value}
      options={options}
      isLoading={pending}
      placeholder="No weeks yet"
      onChange={(next) => {
        const q = new URLSearchParams({ week: String(next) });
        if (day) q.set("day", day);
        start(() => router.push(`/venues/${venueId}/week?${q.toString()}`));
      }}
    />
  );
}

/** Pick a trading day; the address carries the choice, the backend answers. */
export function DatePicker({
  venueId,
  param,
  label,
  value,
  keep,
}: {
  venueId: string;
  param: "day";
  label: string;
  value: string | undefined;
  /** The other choice in the address, kept when this one changes. */
  keep: { param: "week"; value: string | undefined };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <DateInput
      label={label}
      value={(value ?? null) as Value}
      isLoading={pending}
      onChange={(next) => {
        if (!next) return;
        const q = new URLSearchParams();
        q.set(param, String(next));
        if (keep.value) q.set(keep.param, keep.value);
        start(() => router.push(`/venues/${venueId}/week?${q.toString()}`));
      }}
    />
  );
}
