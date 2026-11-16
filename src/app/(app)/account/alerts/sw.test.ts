import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Handler = (event: unknown) => void;

/** Run public/sw.js against a fake worker scope and give back what it registered and did. */
function load() {
  const handlers = new Map<string, Handler>();
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  let focused = 0;
  const state = { windows: [] as unknown[] };
  const self = {
    location: { origin: "https://app.example.com" },
    addEventListener: (name: string, fn: Handler) => handlers.set(name, fn),
    skipWaiting: () => {},
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(state.windows),
      openWindow: (url: string) => {
        opened.push(url);
        return Promise.resolve(null);
      },
    },
  };
  const code = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
  new Function("self", "URL", code)(self, URL);
  const waits: Promise<unknown>[] = [];
  const fire = async (name: string, event: Record<string, unknown>) => {
    await (handlers.get(name) as Handler)({
      ...event,
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    await Promise.all(waits.splice(0));
  };
  const windowClient = {
    focus: () => {
      focused += 1;
      return Promise.resolve(windowClient);
    },
    navigate: (url: string) => {
      navigated.push(url);
      return Promise.resolve(windowClient);
    },
  };
  return {
    fire,
    shown,
    opened,
    navigated,
    state,
    windowClient,
    focused: () => focused,
  };
}

const pushOf = (payload: unknown) => ({
  data: { json: () => payload },
});
const click = (url: unknown) => ({
  notification: { close: () => {}, data: { url } },
});

describe("push", () => {
  test("shows only the title and body, tagged by the venue url, with the app icon", async () => {
    const sw = load();
    await sw.fire(
      "push",
      pushOf({
        title: "2 updates at The Pass",
        body: "Open Minder to read them",
        url: "/venues/abc/notices",
        pay: "$400",
        extra: "x",
      }),
    );
    expect(sw.shown).toEqual([
      {
        title: "2 updates at The Pass",
        options: {
          body: "Open Minder to read them",
          icon: "/icon-192.png",
          tag: "/venues/abc/notices",
          data: { url: "/venues/abc/notices" },
        },
      },
    ]);
  });
  test("a bad payload still shows something plain and never an outside link", async () => {
    const sw = load();
    await sw.fire("push", {
      data: {
        json: () => {
          throw new Error("not json");
        },
      },
    });
    await sw.fire(
      "push",
      pushOf({ title: "x", body: "y", url: "https://evil.example/venues/1" }),
    );
    expect(sw.shown[0]?.title).toBe("Minder");
    expect(sw.shown[0]?.options.tag).toBe("/");
    expect(sw.shown[1]?.options.tag).toBe("/");
  });
});

describe("notificationclick", () => {
  test("opens a window on the venue page when none is open", async () => {
    const sw = load();
    await sw.fire("notificationclick", click("/venues/abc/notices?x=1"));
    expect(sw.opened).toEqual(["/venues/abc/notices?x=1"]);
  });
  test("focuses and uses an open window", async () => {
    const sw = load();
    sw.state.windows = [sw.windowClient];
    await sw.fire("notificationclick", click("/venues/abc/notices"));
    expect(sw.focused()).toBe(1);
    expect(sw.navigated).toEqual(["/venues/abc/notices"]);
    expect(sw.opened).toEqual([]);
  });
  test.each([
    "https://evil.example/venues/1",
    "//evil.example/venues/1",
    "/venues/../admin",
    "/account/profile",
    "venues/abc",
    "/venues\\evil",
    "javascript:alert(1)",
    undefined,
    42,
  ])("anything else goes to the home page: %p", async (url) => {
    const sw = load();
    await sw.fire("notificationclick", click(url));
    expect(sw.opened).toEqual(["/"]);
  });
});
