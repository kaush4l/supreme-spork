"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MutationResult, simulateMutation } from "../../adapter";
import type { FeedbackStatus } from "../../components/section";
import { initialInbox } from "../../fixtures/inbox";
import { personas } from "../../fixtures/personas";
import { venues } from "../../fixtures/venues";
import { useProto, useProtoSlice } from "../../state/store";
import type { InboxItem, InboxTab, PersonaId } from "../../types";
import {
  acknowledge,
  applyRemote,
  busyExtras,
  decide,
  markAllRead,
  markRead,
  queueRemote,
  type RemoteEvent,
  type RemoteKind,
  sortFeed,
} from "./inbox-logic";

export interface Feedback {
  status: FeedbackStatus;
  message?: string;
}

/**
 * Recipient- and venue-scoped Inbox state (survives navigation, cleared by Reset). Slices hold null until the first
 * change; the fixture is the fallback so a venue switch never reuses another venue's initial data.
 */
export function useInbox(personaId: PersonaId) {
  const persona = personas[personaId];
  const p = useProto();
  const { venueId, scenario, resetCount } = p;
  const venue = venues.find((v) => v.id === venueId);
  const flavour = scenario === "busy" ? "busy" : "std";
  const sfx = `${persona.recipientId}.${venueId}.${flavour}`;

  const base = useMemo(() => {
    if (venue?.empty) return [] as InboxItem[];
    const std = initialInbox(persona.recipientId, venueId);
    return flavour === "busy"
      ? sortFeed([...std, ...busyExtras(persona.recipientId, venueId)])
      : std;
  }, [venue?.empty, persona.recipientId, venueId, flavour]);

  const [stored, setStored] = useProtoSlice<InboxItem[] | null>(
    `inbox.items.${sfx}`,
    null,
  );
  const [remote, setRemote] = useProtoSlice<RemoteEvent[]>(
    `inbox.remote.${sfx}`,
    [],
  );
  const [log, setLog] = useProtoSlice<string[]>(`inbox.log.${sfx}`, []);
  const [feedback, setFeedback] = useState<Feedback>({ status: "idle" });

  const all = stored ?? base;
  // 'empty' scenario shows an empty Inbox without touching stored state.
  const items = scenario === "empty" ? [] : all;

  const seen = useRef(new Set<string>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset must clear the duplicate-submit guard
  useEffect(() => {
    seen.current = new Set();
  }, [resetCount]);

  const update = useCallback(
    (fn: (cur: InboxItem[]) => InboxItem[], entry: string) => {
      setStored((prev) => fn(prev ?? base));
      setLog((l) => [...l, entry]);
    },
    [setStored, setLog, base],
  );

  /** One simulated write: pending / success / failure feedback; a repeat of the same key is ignored. */
  const mutate = useCallback(
    (key: string, fn: () => void, okMessage: string, quiet = false) => {
      const r: MutationResult<void> = simulateMutation(fn, {
        scenario,
        key,
        seen: seen.current,
      });
      if (r.status === "duplicate") return r;
      if (r.status === "success") {
        // Keep the guard: the same (item, action) cannot be repeated until Reset.
        if (!quiet) setFeedback({ status: "success", message: okMessage });
      } else {
        seen.current.delete(key); // nothing happened, so a retry is allowed
        setFeedback(
          r.status === "failure"
            ? { status: "error", message: `${r.message} Try again.` }
            : {
                status: "pending",
                message:
                  "The sample data is in a slow or loading scenario, so this change was not sent. Nothing changed; try again after the scenario is Default.",
              },
        );
      }
      return r;
    },
    [scenario],
  );

  const byId = (id: string) => all.find((i) => i.id === id);

  return {
    persona,
    venueId,
    venue,
    scenario,
    resetCount,
    all,
    items,
    remote,
    log,
    feedback,
    setFeedback,
    dismissFeedback: () => setFeedback({ status: "idle" }),
    byId,
    markRead: (id: string, quiet = false) => {
      if (byId(id)?.read) return;
      mutate(
        `read:${id}`,
        () => update((c) => markRead(c, id), `read ${id}`),
        "Marked as read. Nothing was acknowledged or resolved.",
        quiet,
      );
    },
    markAllRead: (tab: InboxTab) =>
      mutate(
        `readall:${tab}:${all.filter((i) => i.tab === tab && !i.read).length}`,
        () => update((c) => markAllRead(c, tab), `read-all ${tab}`),
        "All marked as read. Nothing was acknowledged or resolved.",
      ),
    acknowledge: (id: string) =>
      mutate(
        `ack:${id}`,
        () => update((c) => acknowledge(c, id), `ack ${id}`),
        "Acknowledged. This is separate from reading.",
      ),
    decide: (id: string, d: "approved" | "declined") =>
      mutate(
        `decide:${id}`,
        () => update((c) => decide(c, id, d), `${d} ${id}`),
        d === "approved" ? "Approved (simulated)." : "Declined (simulated).",
      ),
    /** Scenario control: another actor changes the subject on the "server"; the page shows it after Refresh. */
    emit: (kind: RemoteKind, subjectId: string) => {
      setRemote((r) => queueRemote(r, { kind, subjectId }));
    },
    refresh: () => {
      if (scenario === "error") {
        setFeedback({
          status: "error",
          message:
            "Refresh failed (simulated). Showing what was loaded before.",
        });
        return;
      }
      const res = applyRemote(all, remote);
      if (res.changed > 0) setStored(res.items);
      setRemote([]);
      setFeedback({
        status: "success",
        message:
          res.changed > 0
            ? `Refreshed: ${res.changed} action${res.changed === 1 ? "" : "s"} resolved elsewhere. Unread state is unchanged.`
            : "Refreshed: nothing changed.",
      });
    },
  };
}

export type InboxApi = ReturnType<typeof useInbox>;
