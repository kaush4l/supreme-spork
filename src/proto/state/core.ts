import type { Scenario } from "../types";
import type { Mode } from "./nav";

export const SCENARIOS: Scenario[] = [
  "default",
  "busy",
  "loading",
  "empty",
  "error",
  "stale",
  "denied",
  "partial",
  "slow",
];
export const SLOW_DELAY_MS = 1500;
export const STORAGE_KEY = "proto:session:v1";

export function parseScenario(v: string | null | undefined): Scenario | null {
  return SCENARIOS.includes(v as Scenario) ? (v as Scenario) : null;
}

export interface CoreState {
  scenario: Scenario;
  venueId: string;
  mode: Mode | null;
  signedOut: boolean;
  resetCount: number;
  /** True once the user pressed "Finish loading" for the current scenario. */
  loadingReleased: boolean;
  slices: Record<string, unknown>;
}

export const INITIAL_STATE: CoreState = {
  scenario: "default",
  venueId: "v-harbour",
  mode: null,
  signedOut: false,
  resetCount: 0,
  loadingReleased: false,
  slices: {},
};

export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** Framework-free store so the logic is testable with bun. */
export function createCore(
  storage: () => KeyValueStorage | null = () => null,
  setTimer: (fn: () => void, ms: number) => unknown = setTimeout,
) {
  let state: CoreState = INITIAL_STATE;
  const listeners = new Set<() => void>();
  let gate: Array<() => void> = [];

  const emit = () => {
    for (const l of listeners) l();
  };
  const persist = () => {
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage blocked or full: the prototype keeps working in memory
    }
  };
  const set = (patch: Partial<CoreState>) => {
    state = { ...state, ...patch };
    persist();
    emit();
  };

  return {
    get: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    /** Restore a saved session, then let ?scenario= win. Call once on the client after mount. */
    hydrate(search: string) {
      let saved: Partial<CoreState> = {};
      try {
        const raw = storage()?.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw) as Partial<CoreState>;
      } catch {
        saved = {};
      }
      const fromQuery = parseScenario(
        new URLSearchParams(search).get("scenario"),
      );
      const scenario = fromQuery ?? parseScenario(saved.scenario) ?? "default";
      state = {
        ...INITIAL_STATE,
        ...saved,
        scenario,
        loadingReleased:
          fromQuery && fromQuery !== saved.scenario
            ? false
            : !!saved.loadingReleased,
        slices:
          saved.slices && typeof saved.slices === "object" ? saved.slices : {},
      };
      persist();
      emit();
    },
    setScenario(s: Scenario) {
      set({ scenario: s, loadingReleased: false });
    },
    setVenue(id: string) {
      set({ venueId: id });
    },
    setMode(m: Mode | null) {
      set({ mode: m });
    },
    setSigned(out: boolean) {
      set({ signedOut: out });
    },
    setSlice(key: string, value: unknown) {
      set({ slices: { ...state.slices, [key]: value } });
    },
    /** Deterministic reset: fixture state only. Scenario, venue and mode are kept; all slices are dropped. */
    reset() {
      set({
        slices: {},
        resetCount: state.resetCount + 1,
        loadingReleased: false,
      });
    },
    releaseLoading() {
      set({ loadingReleased: true });
      const waiting = gate;
      gate = [];
      for (const r of waiting) r();
    },
    /** 'slow' resolves after 1500 ms; 'loading' waits for releaseLoading(); others resolve immediately. */
    scenarioDelay(): Promise<void> {
      const { scenario, loadingReleased } = state;
      if (scenario === "slow") {
        return new Promise((res) => setTimer(res, SLOW_DELAY_MS));
      }
      if (scenario === "loading" && !loadingReleased) {
        return new Promise((res) => gate.push(res));
      }
      return Promise.resolve();
    },
  };
}
export type Core = ReturnType<typeof createCore>;

export type VenueSwitchGuard = (
  from: string,
  to: string,
) => "allow" | "handled";
let guard: VenueSwitchGuard | null = null;
/** Register the 'beforeVenueSwitch' guard (roster uses it to intercept unsaved drafts). Returns an unregister fn. */
export function registerVenueSwitchGuard(fn: VenueSwitchGuard): () => void {
  guard = fn;
  return () => {
    if (guard === fn) guard = null;
  };
}
export function runVenueSwitchGuard(
  from: string,
  to: string,
): "allow" | "handled" {
  return guard ? guard(from, to) : "allow";
}
