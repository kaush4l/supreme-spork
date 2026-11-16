"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isDay } from "../timesheet/range";
import {
  type Filters,
  isKind,
  KIND_OPTIONS,
  listHref,
  STATUS_FILTER_OPTIONS,
} from "./words";

const KINDS = [{ value: "all", label: "All kinds" }, ...KIND_OPTIONS];

/** Narrow the list by kind, by waiting-to-be-confirmed, and by the day paid. Keeps a person or supplier filter from the address. */
export function FilterForm({
  venueId,
  filters,
}: {
  venueId: string;
  filters: Filters;
}) {
  const router = useRouter();
  const [kind, setKind] = useState(filters.kind ?? "all");
  const [status, setStatus] = useState(
    filters.unconfirmed ? "unconfirmed" : "all",
  );
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const show = () => {
    if ((from !== "" && !isDay(from)) || (to !== "" && !isDay(to)))
      return setMessage("Write dates like 2026-11-16, or leave them empty.");
    if (from !== "" && to !== "" && to < from)
      return setMessage("The end date is before the start date.");
    setMessage(null);
    router.push(
      listHref(venueId, {
        ...(isKind(kind) ? { kind } : {}),
        ...(status === "unconfirmed" ? { unconfirmed: true } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(filters.person ? { person: filters.person } : {}),
        ...(filters.supplier ? { supplier: filters.supplier } : {}),
      }),
    );
  };

  return (
    <VStack gap={2} hAlign="stretch">
      <HStack gap={2} wrap="wrap">
        <Selector
          label="Kind"
          value={kind}
          options={KINDS}
          onChange={setKind}
        />
        <Selector
          label="Show"
          value={status}
          options={STATUS_FILTER_OPTIONS}
          onChange={setStatus}
        />
      </HStack>
      <HStack gap={2}>
        <TextInput
          label="Paid from"
          value={from}
          onChange={setFrom}
          placeholder="2026-11-09"
          isOptional
        />
        <TextInput
          label="Paid to"
          value={to}
          onChange={setTo}
          placeholder="2026-11-15"
          isOptional
        />
      </HStack>
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2}>
        <Button label="Show" variant="primary" onClick={show} />
      </HStack>
    </VStack>
  );
}
