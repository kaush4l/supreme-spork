"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRef, useState } from "react";
import { isDay } from "../timesheet/range";

type Dataset = { key: string; title: string; help: string };

export function DownloadForm({
  venueId,
  datasets,
  from,
  to,
}: {
  venueId: string;
  datasets: readonly Dataset[];
  from: string;
  to: string;
}) {
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const working = useRef(false);

  const download = async (key: string, href: string) => {
    if (working.current) return;
    if (!isDay(a) || !isDay(b))
      return setMessage("Write both dates like 2026-11-16.");
    if (b < a) return setMessage("The end date is before the start date.");
    setMessage(null);
    working.current = true;
    setBusy(key);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return setMessage(
          typeof body?.error?.message === "string"
            ? body.error.message
            : "We could not make that file. Please try again.",
        );
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${key}-${a}-${b}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("We could not reach the server. Check your connection.");
    } finally {
      working.current = false;
      setBusy(null);
    }
  };

  return (
    <VStack gap={4} hAlign="stretch">
      <HStack gap={2}>
        <TextInput
          label="From"
          value={a}
          onChange={setA}
          placeholder="2026-11-09"
        />
        <TextInput
          label="To"
          value={b}
          onChange={setB}
          placeholder="2026-11-15"
        />
      </HStack>
      {message ? <Banner status="error" title={message} /> : null}
      {datasets.map((d) => {
        const href = `/venues/${venueId}/downloads/${d.key}?from=${a}&to=${b}`;
        return (
          <VStack key={d.key} gap={1} hAlign="stretch">
            <Heading level={3}>{d.title}</Heading>
            <Text type="supporting" color="secondary">
              {d.help}
            </Text>
            <Link
              href={href}
              download
              onClick={(e) => {
                e.preventDefault();
                void download(d.key, href);
              }}
            >
              {busy === d.key
                ? "Getting the file"
                : `Download ${d.title.toLowerCase()} (CSV)`}
            </Link>
          </VStack>
        );
      })}
    </VStack>
  );
}
