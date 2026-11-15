"use client";

import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IsoDay } from "../requests/words";

/** Pick the dates to look at. The choice goes in the address (`?from=&to=`), so the page itself does the reading. */
export function RangeForm({
  venueId,
  from,
  to,
}: {
  venueId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [a, setA] = useState<IsoDay | undefined>(
    (from || undefined) as IsoDay | undefined,
  );
  const [b, setB] = useState<IsoDay | undefined>(
    (to || undefined) as IsoDay | undefined,
  );
  return (
    <VStack gap={3} hAlign="stretch">
      <DateInput label="From" value={a} onChange={setA} />
      <DateInput label="To" value={b} onChange={setB} />
      <Button
        label="Show these days"
        size="lg"
        isDisabled={!a || !b}
        onClick={() => {
          if (a && b)
            router.push(
              `/venues/${venueId}/pay?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`,
            );
        }}
      />
    </VStack>
  );
}
