import { describe, expect, test } from "bun:test";
import {
  createCore,
  type KeyValueStorage,
  registerVenueSwitchGuard,
  runVenueSwitchGuard,
  STORAGE_KEY,
} from "./core";

function mem(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe("core store", () => {
  test("scenario from query wins and persists", () => {
    const s = mem();
    const c = createCore(() => s);
    c.hydrate("?scenario=error");
    expect(c.get().scenario).toBe("error");
    expect(JSON.parse(s.data.get(STORAGE_KEY) ?? "{}").scenario).toBe("error");
    const c2 = createCore(() => s);
    c2.hydrate("");
    expect(c2.get().scenario).toBe("error");
  });
  test("invalid scenario ignored", () => {
    const c = createCore();
    c.hydrate("?scenario=bogus");
    expect(c.get().scenario).toBe("default");
  });
  test("reset clears slices only", () => {
    const c = createCore();
    c.setScenario("busy");
    c.setVenue("v-perth");
    c.setSlice("a", 1);
    c.reset();
    expect(c.get().slices).toEqual({});
    expect(c.get().resetCount).toBe(1);
    expect(c.get().scenario).toBe("busy");
    expect(c.get().venueId).toBe("v-perth");
  });
  test("broken storage does not throw", () => {
    const c = createCore(() => ({
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
    }));
    c.hydrate("");
    c.setSlice("k", 2);
    expect(c.get().slices.k).toBe(2);
  });
  test("delay: loading waits for release, slow uses timer, default immediate", async () => {
    const timers: Array<() => void> = [];
    const c = createCore(
      () => null,
      (fn) => {
        timers.push(fn);
      },
    );
    await c.scenarioDelay();
    c.setScenario("loading");
    let done = false;
    const p = c.scenarioDelay().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    c.releaseLoading();
    await p;
    expect(done).toBe(true);
    c.setScenario("slow");
    let slowDone = false;
    const sp = c.scenarioDelay().then(() => {
      slowDone = true;
    });
    await Promise.resolve();
    expect(slowDone).toBe(false);
    timers[0]();
    await sp;
    expect(slowDone).toBe(true);
  });
  test("venue switch guard", () => {
    expect(runVenueSwitchGuard("a", "b")).toBe("allow");
    const off = registerVenueSwitchGuard(() => "handled");
    expect(runVenueSwitchGuard("a", "b")).toBe("handled");
    off();
    expect(runVenueSwitchGuard("a", "b")).toBe("allow");
  });
});
