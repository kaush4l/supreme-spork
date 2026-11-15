"use client";

import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { type ComponentProps, useState } from "react";

type Day = ComponentProps<typeof DateInput>["value"];

/** Pick the Monday a week starts. The backend says if the day is not a Monday. */
export function WeekForm({
  venueId,
  week,
}: {
  venueId: string;
  week?: string;
}) {
  const router = useRouter();
  const [day, setDay] = useState<Day | undefined>(week as Day | undefined);
  return (
    <VStack gap={2} hAlign="start">
      <HStack gap={2} wrap="wrap">
        <DateInput
          label="Week starting (a Monday)"
          value={day}
          onChange={setDay}
        />
      </HStack>
      <Button
        label="Show this week"
        onClick={() =>
          router.push(
            day
              ? `/venues/${venueId}/suppliers/compare?week=${day}`
              : `/venues/${venueId}/suppliers/compare`,
          )
        }
      />
    </VStack>
  );
}
