"use client";

import { DateInput } from "@astryxdesign/core/DateInput";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useTransition } from "react";

/** Choose which trading day the board shows. The backend decides what the day contains. */
export function DayPicker({ venueId, day }: { venueId: string; day: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <DateInput
      label="Day"
      value={day as ComponentProps<typeof DateInput>["value"]}
      isLoading={pending}
      onChange={(value) => {
        if (value)
          start(() => router.push(`/venues/${venueId}/board?day=${value}`));
      }}
    />
  );
}
