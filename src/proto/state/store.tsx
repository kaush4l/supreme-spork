"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Scenario } from "../types";
import {
  type Core,
  createCore,
  INITIAL_STATE,
  runVenueSwitchGuard,
} from "./core";
import type { Mode } from "./nav";

export { registerVenueSwitchGuard } from "./core";

function sessionStore() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const CoreContext = createContext<Core | null>(null);

export function ProtoProvider({ children }: { children: ReactNode }) {
  const [core] = useState(() => createCore(sessionStore));
  useEffect(() => {
    core.hydrate(window.location.search);
  }, [core]);
  return <CoreContext.Provider value={core}>{children}</CoreContext.Provider>;
}

function useCore(): Core {
  const c = useContext(CoreContext);
  if (!c) throw new Error("useProto must be used inside <ProtoProvider>");
  return c;
}

export interface ProtoApi {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  venueId: string;
  /** Runs the registered beforeVenueSwitch guard unless `force`; returns whether the switch happened. */
  setVenue: (id: string, opts?: { force?: boolean }) => boolean;
  /** Current Staff/Management mode (null until chosen; use the persona default then). */
  mode: Mode | null;
  setMode: (m: Mode | null) => void;
  signedOut: boolean;
  signOut: () => void;
  signIn: () => void;
  resetCount: number;
  resetFixtures: () => void;
  /** True once the user pressed "Finish loading" (scenario 'loading'). */
  loadingReleased: boolean;
  releaseLoading: () => void;
}

export function useProto(): ProtoApi {
  const core = useCore();
  const s = useSyncExternalStore(core.subscribe, core.get, () => INITIAL_STATE);
  return useMemo(
    () => ({
      scenario: s.scenario,
      setScenario: core.setScenario,
      venueId: s.venueId,
      setVenue: (id, opts) => {
        const from = core.get().venueId;
        if (id === from) return false;
        if (!opts?.force && runVenueSwitchGuard(from, id) === "handled") {
          return false;
        }
        core.setVenue(id);
        return true;
      },
      mode: s.mode,
      setMode: core.setMode,
      signedOut: s.signedOut,
      signOut: () => core.setSigned(true),
      signIn: () => core.setSigned(false),
      resetCount: s.resetCount,
      resetFixtures: core.reset,
      loadingReleased: s.loadingReleased,
      releaseLoading: core.releaseLoading,
    }),
    [core, s],
  );
}

/**
 * Keyed state that survives navigation and refresh (sessionStorage) and is cleared by resetFixtures().
 * `initial` must be JSON-serialisable and is what you get after a reset.
 */
export function useProtoSlice<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const core = useCore();
  const initialRef = useRef(initial);
  const value = useSyncExternalStore(
    core.subscribe,
    () => (core.get().slices[key] as T | undefined) ?? initialRef.current,
    () => initialRef.current,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev =
        (core.get().slices[key] as T | undefined) ?? initialRef.current;
      core.setSlice(
        key,
        typeof next === "function" ? (next as (p: T) => T)(prev) : next,
      );
    },
    [core, key],
  );
  return [value, set];
}

/**
 * Returns `delay()`: 'slow' resolves after a deterministic 1500 ms, 'loading' never resolves until the user presses
 * "Finish loading" in the scenario panel, every other scenario resolves immediately.
 */
export function useScenarioDelay(): () => Promise<void> {
  const core = useCore();
  return useCallback(() => core.scenarioDelay(), [core]);
}

/**
 * Convenience for screens: `ready` is false while the current scenario ('slow' or 'loading') is still delaying and
 * re-arms on scenario, venue or reset changes.
 */
export function useScenarioReady(): boolean {
  const core = useCore();
  const { scenario, venueId, resetCount, loadingReleased } = useProto();
  const [done, setDone] = useState<string | null>(null);
  const token = `${scenario}|${venueId}|${resetCount}|${loadingReleased}`;
  useEffect(() => {
    let live = true;
    core.scenarioDelay().then(() => {
      if (live) setDone(token);
    });
    return () => {
      live = false;
    };
  }, [core, token]);
  const needsWait =
    scenario === "slow" || (scenario === "loading" && !loadingReleased);
  return !needsWait || done === token;
}
