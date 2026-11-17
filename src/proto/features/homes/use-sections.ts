"use client";

import { useMemo } from "react";
import { useProto, useProtoSlice, useScenarioReady } from "../../state/store";
import type { Scenario, SectionResult } from "../../types";
import { effectiveScenario, pickSection } from "./sections";

export interface Sections<H> {
  scenario: Scenario;
  get: <T>(key: keyof H & string) => SectionResult<T>;
  retry: (key: keyof H & string) => void;
}

/**
 * Per-section state for a home. `fn` must be a stable (module-level) fixture function. Each section independently
 * shows a skeleton while the scenario delays, an error with its own Retry, or its data; retrying one section
 * (simulated success) never touches its siblings.
 */
export function useSections<H extends object, A>(
  ns: string,
  fn: (venueId: string, s: Scenario, arg: A) => H,
  arg: A,
): Sections<H> {
  const p = useProto();
  const ready = useScenarioReady();
  const scenario = effectiveScenario(p.scenario, p.loadingReleased);
  const [retried, setRetried] = useProtoSlice<Record<string, boolean>>(
    `homes:retry:${ns}:${p.venueId}:${scenario}`,
    {},
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetCount re-derives fixtures after a reset
  const base = useMemo(
    () => fn(p.venueId, scenario, arg),
    [fn, p.venueId, scenario, arg, p.resetCount],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetCount re-derives fixtures after a reset
  const fallback = useMemo(
    () => fn(p.venueId, "default", arg),
    [fn, p.venueId, arg, p.resetCount],
  );
  return {
    scenario,
    get: <T>(key: keyof H & string) =>
      pickSection(
        ready,
        (base as Record<string, SectionResult<T>>)[key] as SectionResult<T>,
        (fallback as Record<string, SectionResult<T>>)[key] as SectionResult<T>,
        !!retried[key],
      ),
    retry: (key) => setRetried((r) => ({ ...r, [key]: true })),
  };
}
