"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useState, useTransition } from "react";
import { copyLastWeek, offerShift, openShift, publishWeek } from "./actions";
import { ShiftDialog } from "./shift-dialog";
import type { DayView, PersonOption, ShiftView } from "./types";

const WARNING_WORDS: Record<string, string> = {
  rest: "Short rest",
  hours: "Many hours",
  days_in_row: "Many days in a row",
  availability: "Not available",
  certificate: "Certificate",
};

type Editing = { shift: ShiftView | null; date: string } | null;

/**
 * The week as day cards (columns on a wide screen, a stacked list on a phone) with the add, copy and publish buttons.
 * Warnings are the backend's own words next to the shift; nothing is decided here. The publish button exists only for
 * a caller who holds the publish right, and the backend still checks.
 */
export function RosterBoard({
  venueId,
  week,
  days,
  extra,
  positions,
  people,
  canPublish,
  hasShifts,
  changesLabel,
}: {
  venueId: string;
  week: string;
  days: DayView[];
  extra: ShiftView[];
  positions: string[];
  people: PersonOption[];
  canPublish: boolean;
  hasShifts: boolean;
  changesLabel: string | null;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, run] = useTransition();
  const [copyKey, setCopyKey] = useState(() => crypto.randomUUID());
  const [publishKey, setPublishKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    status: "success" | "info";
    title: string;
    approval: boolean;
    detail?: string;
  } | null>(null);
  const [offering, setOffering] = useState<string | null>(null);
  const [offerKey, setOfferKey] = useState(() => crypto.randomUUID());

  const copy = () =>
    run(async () => {
      setError(null);
      setNotice(null);
      const r = await copyLastWeek({ venueId, key: copyKey, week });
      if (!r.ok) return setError(r.error.message);
      setCopyKey(crypto.randomUUID());
      setNotice({
        status: "success",
        title: "Last week was copied into this one.",
        approval: false,
      });
    });

  const publish = () =>
    run(async () => {
      setError(null);
      setNotice(null);
      const r = await publishWeek({ venueId, key: publishKey, week });
      if (!r.ok) return setError(r.error.message);
      setPublishKey(crypto.randomUUID());
      if (r.data.kind === "approval")
        setNotice({
          status: "info",
          title: "Sent for approval",
          approval: true,
        });
      else if (r.data.unchanged)
        setNotice({
          status: "info",
          title: "Nothing new to publish",
          approval: false,
        });
      else
        setNotice({
          status: "success",
          title: `Published as version ${r.data.version}.`,
          approval: false,
        });
    });

  const offer = (s: ShiftView) =>
    run(async () => {
      if (offering) return;
      setOffering(s.id);
      setError(null);
      setNotice(null);
      const r = await offerShift({ venueId, key: offerKey, externalId: s.id });
      setOffering(null);
      if (!r.ok) return setError(r.error.message);
      setOfferKey(crypto.randomUUID());
      setNotice({
        status: "success",
        title: `Offered. ${r.data.told} ${r.data.told === 1 ? "person was" : "people were"} told.`,
        approval: false,
        detail:
          r.data.eligible.length > 0
            ? `Could work it: ${r.data.eligible.join(", ")}.`
            : "Nobody on the team could work it.",
      });
    });

  const makeOpen = (s: ShiftView) =>
    run(async () => {
      if (offering) return;
      setOffering(s.id);
      setError(null);
      setNotice(null);
      const r = await openShift({ venueId, externalId: s.id });
      setOffering(null);
      if (!r.ok) return setError(r.error.message);
      setNotice({
        status: "success",
        title: `${s.who} is off that shift. It is open.`,
        approval: false,
      });
    });

  const card = (s: ShiftView) => (
    <VStack key={s.id} gap={1} hAlign="stretch">
      <Text type="body">
        {s.position} · {s.who}
      </Text>
      <Text type="supporting" color="secondary">
        {s.span}
      </Text>
      <HStack gap={1}>
        <Badge
          label={s.published ? "Published" : "Not published"}
          variant={s.published ? "neutral" : "info"}
        />
      </HStack>
      {s.warnings.map((w) => (
        <Text
          key={`${w.kind}:${w.message}`}
          type="supporting"
          color="secondary"
        >
          {WARNING_WORDS[w.kind] ?? "Check"}: {w.message}
        </Text>
      ))}
      <HStack gap={1} wrap="wrap">
        <Button
          label="Edit"
          variant="secondary"
          size="sm"
          onClick={() => setEditing({ shift: s, date: "" })}
        />
        {s.isOpen ? (
          <Button
            label="Offer it"
            variant="secondary"
            size="sm"
            isLoading={offering === s.id}
            isDisabled={pending}
            onClick={() => offer(s)}
          />
        ) : (
          <Button
            label="Make open"
            variant="secondary"
            size="sm"
            isLoading={offering === s.id}
            isDisabled={pending}
            onClick={() => makeOpen(s)}
          />
        )}
      </HStack>
    </VStack>
  );

  return (
    <VStack gap={3} hAlign="stretch">
      <HStack gap={2} wrap="wrap">
        <Button
          label="Add a shift"
          variant="primary"
          onClick={() => setEditing({ shift: null, date: week })}
        />
        {!hasShifts ? (
          <Button
            label="Copy last week"
            variant="secondary"
            isLoading={pending}
            onClick={copy}
          />
        ) : null}
        {canPublish ? (
          <Button
            label="Publish"
            variant="secondary"
            isLoading={pending}
            isDisabled={!hasShifts}
            onClick={publish}
          />
        ) : null}
      </HStack>
      {changesLabel ? (
        <Text type="supporting" color="secondary">
          {changesLabel}
        </Text>
      ) : null}
      {error ? <Banner status="error" title={error} /> : null}
      {notice ? (
        <Banner
          status={notice.status}
          title={notice.title}
          description={
            notice.approval ? (
              <Link href={`/venues/${venueId}/changes`}>
                See change requests
              </Link>
            ) : (
              notice.detail
            )
          }
        />
      ) : null}
      {!hasShifts ? (
        <Text type="body" color="secondary">
          Nothing is rostered this week yet. Add a shift or copy last week.
        </Text>
      ) : null}
      <Grid columns={{ minWidth: 200, repeat: "fill" }} gap={3} align="start">
        {days.map((d) => (
          <Card key={d.date} padding={3}>
            <VStack gap={3} hAlign="stretch">
              <HStack gap={2} justify="between">
                <Heading level={3}>{d.label}</Heading>
                <Button
                  label="Add"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing({ shift: null, date: d.date })}
                />
              </HStack>
              {d.shifts.length === 0 ? (
                <Text type="supporting" color="secondary">
                  No shifts
                </Text>
              ) : (
                d.shifts.map(card)
              )}
            </VStack>
          </Card>
        ))}
      </Grid>
      {extra.length > 0 ? (
        <Card padding={3}>
          <VStack gap={3} hAlign="stretch">
            <Heading level={3}>Starting outside this week</Heading>
            {extra.map(card)}
          </VStack>
        </Card>
      ) : null}
      {editing ? (
        <ShiftDialog
          key={editing.shift?.id ?? `new-${editing.date}`}
          venueId={venueId}
          shift={editing.shift}
          startDate={editing.date}
          positions={positions}
          people={people}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </VStack>
  );
}
