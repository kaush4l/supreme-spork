"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clockIn, clockOut } from "./actions";

type Place = { latitude: number; longitude: number; accuracy_m: number };

function here(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy_m: p.coords.accuracy,
        }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/**
 * Clock in or out. A key is made when the card is drawn and replaced only after the write worked, so a double tap or a
 * retry after a dropped connection adds one entry, not two. At a venue that checks where the phone is, the position
 * is read first; if it cannot be read, the person is told what to switch on.
 */
export function ClockCard({
  venueId,
  clockedIn,
  sinceLabel,
  method,
  shiftLabel,
}: {
  venueId: string;
  clockedIn: boolean;
  sinceLabel: string | null;
  method: string;
  shiftLabel: string | null;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const finish = (result: { ok: boolean; error?: { message: string } }) => {
    if (!result.ok) {
      setMessage(result.error?.message ?? "That did not work.");
      return;
    }
    setKey(crypto.randomUUID());
    router.refresh();
  };

  const onIn = () =>
    start(async () => {
      setMessage(null);
      setNotice(null);
      let where: Place | undefined;
      if (method === "location") {
        try {
          where = await here();
        } catch {
          setMessage(
            "We need your location to clock you in here. Allow location for this site in your browser, then try again.",
          );
          return;
        }
      }
      const result = await clockIn({ venueId, key, ...where });
      if (result.ok && result.data.flagged)
        setNotice(
          "Clocked in. You are outside the usual area, so your manager will see a flag.",
        );
      else if (result.ok && result.data.unplanned)
        setNotice("Clocked in. You had no shift planned for now.");
      finish(result);
    });

  const onOut = () =>
    start(async () => {
      setMessage(null);
      setNotice(null);
      finish(await clockOut({ venueId, key, breakMinutes: 0 }));
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Text type="body">
          {clockedIn
            ? `You are clocked in${sinceLabel ? ` since ${sinceLabel}` : ""}.`
            : shiftLabel
              ? `Next shift: ${shiftLabel}`
              : "You are not clocked in."}
        </Text>
        {message ? <Banner status="error" title={message} /> : null}
        {notice ? <Banner status="info" title={notice} /> : null}
        <Button
          label={clockedIn ? "Clock out" : "Clock in"}
          variant="primary"
          size="lg"
          isLoading={pending}
          onClick={clockedIn ? onOut : onIn}
        />
      </VStack>
    </Card>
  );
}
