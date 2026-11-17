"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { simulateMutation } from "../../adapter";
import type { FeedbackStatus } from "../../components/section";
import { useProto, useScenarioDelay } from "../../state/store";

export interface ActionFeedback {
  status: FeedbackStatus;
  message?: string;
}

/** Visible time the pending state is held in every scenario so it is observable (not a race). */
export const PENDING_MS = 600;

/**
 * Simulated write with immediate pending, then success or error. Duplicate clicks while one is running are
 * ignored, and the same attempt key is never run twice (simulateMutation). After a failure the next attempt uses a
 * new key, so the user can retry without losing what they typed. `apply` runs only on success.
 */
export function useSimAction() {
  const { scenario } = useProto();
  const delay = useScenarioDelay();
  const seen = useRef(new Set<string>());
  const attempts = useRef<Record<string, number>>({});
  const busy = useRef(new Set<string>());
  const alive = useRef(true);
  const [fb, setFb] = useState<ActionFeedback>({ status: "idle" });
  const [busyName, setBusyName] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (
      name: string,
      msgs: { pending: string; success: string },
      apply: () => void,
    ): Promise<"success" | "failure" | "ignored"> => {
      if (busy.current.has(name)) return "ignored";
      busy.current.add(name);
      setBusyName(name);
      setFb({ status: "pending", message: msgs.pending });
      const n = attempts.current[name] ?? 0;
      const r = simulateMutation(() => true, {
        scenario,
        key: `${name}#${n}`,
        seen: seen.current,
      });
      await new Promise((res) => setTimeout(res, PENDING_MS));
      if (r.status === "pending") await delay();
      let out: "success" | "failure" | "ignored" = "ignored";
      if (r.status === "failure") {
        attempts.current[name] = n + 1;
        out = "failure";
        if (alive.current)
          setFb({
            status: "error",
            message: `${r.message} Your entries are kept; try again.`,
          });
      } else if (r.status !== "duplicate") {
        out = "success";
        if (alive.current) {
          apply();
          setFb({ status: "success", message: msgs.success });
        }
      }
      busy.current.delete(name);
      if (alive.current) setBusyName(null);
      return out;
    },
    [scenario, delay],
  );

  return {
    fb,
    busyName,
    run,
    clear: () => setFb({ status: "idle" }),
  };
}
