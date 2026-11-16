import { describe, expect, test } from "bun:test";
import {
  canToggle,
  IOS_HINT,
  isIos,
  type PushFacts,
  pushView,
  storageKey,
  urlBase64ToUint8Array,
  VIEW_WORDS,
} from "./push-state";

const base: PushFacts = {
  supported: true,
  permission: "default",
  standalone: false,
  ios: false,
  serverReady: true,
  subscribed: false,
};

describe("pushView", () => {
  test("off when supported, allowed to ask and not subscribed", () => {
    expect(pushView(base)).toBe("off");
  });
  test("on only with permission granted and a live subscription", () => {
    expect(pushView({ ...base, permission: "granted", subscribed: true })).toBe(
      "on",
    );
    expect(pushView({ ...base, subscribed: true })).toBe("off");
    expect(pushView({ ...base, permission: "granted" })).toBe("off");
  });
  test("blocked when the browser says denied", () => {
    expect(pushView({ ...base, permission: "denied", subscribed: true })).toBe(
      "blocked",
    );
  });
  test("not supported without the browser parts", () => {
    expect(pushView({ ...base, supported: false })).toBe("unsupported");
  });
  test("not set up when the server has no keys", () => {
    expect(pushView({ ...base, serverReady: false })).toBe("not_set_up");
  });
  test("iPhone outside the Home Screen app gets the install hint, even though push looks unsupported there", () => {
    expect(pushView({ ...base, ios: true, supported: false })).toBe(
      "ios_install",
    );
    expect(VIEW_WORDS.ios_install).toBe(IOS_HINT);
  });
  test("installed on iPhone works like any other browser", () => {
    expect(pushView({ ...base, ios: true, standalone: true })).toBe("off");
    expect(
      pushView({
        ...base,
        ios: true,
        standalone: true,
        supported: false,
      }),
    ).toBe("unsupported");
  });
  test("the words are the plain ones", () => {
    expect(VIEW_WORDS.unsupported).toBe("Not supported on this browser");
    expect(VIEW_WORDS.blocked).toBe("Blocked in your browser settings");
    expect(VIEW_WORDS.not_set_up).toBe("Not set up yet on this server");
    expect(VIEW_WORDS.on).toBe("On");
    expect(VIEW_WORDS.off).toBe("Off");
  });
  test("only on and off can be toggled", () => {
    expect(canToggle("on")).toBe(true);
    expect(canToggle("off")).toBe(true);
    for (const v of [
      "ios_install",
      "unsupported",
      "blocked",
      "not_set_up",
    ] as const)
      expect(canToggle(v)).toBe(false);
  });
});

describe("isIos", () => {
  test("iPhone and iPad", () => {
    expect(
      isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)"),
    ).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)")).toBe(true);
  });
  test("an iPad in desktop mode, but not a real Mac", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
    expect(isIos(mac, 5)).toBe(true);
    expect(isIos(mac, 0)).toBe(false);
  });
  test("Android and Windows are not", () => {
    expect(isIos("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(false);
    expect(isIos("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });
});

describe("urlBase64ToUint8Array", () => {
  test("decodes base64url without padding", () => {
    // bytes 0xfb 0xff 0xfe -> "-__-" in base64url, "+//+" in base64
    expect([...urlBase64ToUint8Array("-__-")]).toEqual([0xfb, 0xff, 0xfe]);
  });
  test("adds the missing padding", () => {
    expect([...urlBase64ToUint8Array("aGk")]).toEqual([104, 105]);
    expect([...urlBase64ToUint8Array("aA")]).toEqual([104]);
    expect([...urlBase64ToUint8Array("aGVsbG8")]).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });
  test("a real-length VAPID key gives 65 bytes starting 0x04", () => {
    const bytes = new Uint8Array(65);
    bytes[0] = 4;
    for (let i = 1; i < 65; i += 1) bytes[i] = (i * 37) % 256;
    const text = Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const back = urlBase64ToUint8Array(text);
    expect(back.length).toBe(65);
    expect([...back]).toEqual([...bytes]);
  });
  test("ignores surrounding whitespace", () => {
    expect([...urlBase64ToUint8Array(" aGk \n")]).toEqual([104, 105]);
  });
});

describe("storageKey", () => {
  test("is per person so a shared phone never mixes two people", () => {
    expect(storageKey("a")).not.toBe(storageKey("b"));
  });
});
