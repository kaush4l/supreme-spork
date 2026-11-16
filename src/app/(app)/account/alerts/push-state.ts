/**
 * What the "Alerts on this phone" card says. Pure decisions only: the browser facts go in, one plain state comes out.
 * The UI never decides who is notified; it only shows whether this phone is signed up.
 */

export type PushFacts = {
  /** Service workers, push and notifications all exist in this browser. */
  supported: boolean;
  permission: "default" | "granted" | "denied";
  /** Running as an installed app (Home Screen), not a browser tab. */
  standalone: boolean;
  /** An iPhone or iPad (including an iPad that says it is a Mac). */
  ios: boolean;
  /** The server answered with a key. False when it answered 404 push_not_set_up. */
  serverReady: boolean;
  /** We hold the id the server gave AND the browser still has the subscription. */
  subscribed: boolean;
};

export type PushView =
  | "ios_install"
  | "unsupported"
  | "blocked"
  | "not_set_up"
  | "on"
  | "off";

export function pushView(facts: PushFacts): PushView {
  // Safari in a tab on an iPhone has no push at all, so this must come before "not supported".
  if (facts.ios && !facts.standalone) return "ios_install";
  if (!facts.supported) return "unsupported";
  if (facts.permission === "denied") return "blocked";
  if (!facts.serverReady) return "not_set_up";
  return facts.subscribed && facts.permission === "granted" ? "on" : "off";
}

export const IOS_HINT =
  "On iPhone, add Minder to your Home Screen first (Share, then Add to Home Screen), then turn this on.";

export const VIEW_WORDS: Record<PushView, string> = {
  ios_install: IOS_HINT,
  unsupported: "Not supported on this browser",
  blocked: "Blocked in your browser settings",
  not_set_up: "Not set up yet on this server",
  on: "On",
  off: "Off",
};

/** Only these two states have a working switch. */
export function canToggle(view: PushView): boolean {
  return view === "on" || view === "off";
}

/** iPhone, iPad, iPod; an iPad in desktop mode says "Macintosh" but has touch points. */
export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** The server's public key is base64url text; `subscribe` wants the raw bytes. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const clean = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** The key under which this phone remembers the id the server gave it. One per signed-in person. */
export function storageKey(userId: string): string {
  return `minder.push.subscription.${userId}`;
}
