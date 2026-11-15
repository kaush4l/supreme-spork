"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveLocation } from "./actions";

function here(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/** Where the venue is: shown as the backend holds it, and set from the browser's position when the owner is on site. */
export function LocationCard({
  venueId,
  latitude,
  longitude,
  canEdit,
}: {
  venueId: string;
  latitude: number | null;
  longitude: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const use = () =>
    start(async () => {
      setMessage(null);
      setSaved(false);
      let where: { latitude: number; longitude: number };
      try {
        where = await here();
      } catch {
        setMessage(
          "We could not read your location. Allow location for this site in your browser, then try again.",
        );
        return;
      }
      const result = await saveLocation({ venueId, ...where });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="start">
        <Heading level={3}>Where the venue is</Heading>
        <Text type="supporting" color="secondary">
          Used when staff must clock in at the venue. Stand at the venue and
          press the button.
        </Text>
        <Text type="body">
          {latitude !== null && longitude !== null
            ? `Set to ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
            : "Not set yet."}
        </Text>
        {message ? <Banner status="error" title={message} /> : null}
        {saved ? <Banner status="success" title="Location saved." /> : null}
        {canEdit ? (
          <Button
            label="Use my current location"
            isLoading={pending}
            onClick={use}
          />
        ) : null}
      </VStack>
    </Card>
  );
}
