/**
 * Set-up helpers for the staff live specs. They talk to the backend directly (as the demo manager, owner or staff
 * login) to make the data a staff screen needs: a published shift, a request to decide, a rule to switch. The screens
 * under test are always driven through the UI; this file is only for what the UI cannot make on its own.
 */
import { PASSWORD, type Role } from "./live";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";
const AUTH = process.env.E2E_AUTH_URL ?? "http://localhost:54321/auth/v1";
const ANON =
  process.env.AUTH_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TZ = "Australia/Sydney";

const tokens = new Map<Role, string>();

async function token(role: Role): Promise<string> {
  const cached = tokens.get(role);
  if (cached) return cached;
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({
      email: `demo.${role}@example.com`,
      password: PASSWORD,
    }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`no token for ${role}`);
  tokens.set(role, body.access_token);
  return body.access_token;
}

export type ApiAnswer = {
  status: number;
  // biome-ignore lint/suspicious/noExplicitAny: backend answers are untyped
  json: any;
};

export async function api(
  role: Role,
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  body?: unknown,
): Promise<ApiAnswer> {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await token(role)}`,
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

export async function must(answer: Promise<ApiAnswer>, what: string) {
  const a = await answer;
  if (a.status >= 300)
    throw new Error(`${what}: ${a.status} ${JSON.stringify(a.json)}`);
  return a.json;
}

let venue: string | null = null;
export async function venuePath(): Promise<string> {
  if (!venue) {
    const me = await must(api("manager", "GET", "/v1/me"), "me");
    venue = me.venues[0].id as string;
  }
  return `/v1/venues/${venue}`;
}

/** Names of the people in the demo team, by name to id. */
export async function staffIds(): Promise<Record<string, string>> {
  const v = await venuePath();
  const list = await must(api("manager", "GET", `${v}/staff`), "staff");
  return Object.fromEntries(
    (list.items as { id: string; name: string }[]).map((s) => [s.name, s.id]),
  );
}

export const PRIYA = "Priya Nair";

/** `2026-11-16` for today plus `offset` days, in the venue's time zone. */
export function localDay(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

export type MadeShift = {
  id: string;
  day: string;
  start: string;
  end: string;
};

/**
 * A published shift for Priya on a day 2 to 12 days away at a random hour, so two runs rarely meet. `position` should
 * be "Manager" when the manager login must be able to pick it up from the pool.
 */
export async function makeShift(
  opts: {
    position?: string;
    dayOffset?: number;
    hour?: number;
    hours?: number;
    staff?: string;
    open?: boolean;
  } = {},
): Promise<MadeShift> {
  const v = await venuePath();
  const ids = await staffIds();
  const day = localDay(opts.dayOffset ?? 2 + Math.floor(Math.random() * 11));
  const hour = opts.hour ?? Math.floor(Math.random() * 18);
  const hours = opts.hours ?? 2;
  const start = `${day}T${pad(hour)}:00:00`;
  const end = `${day}T${pad(hour + hours)}:00:00`;
  const shift = await must(
    api("manager", "POST", `${v}/roster/shifts`, {
      position: opts.position ?? "Bartender",
      staff_id: opts.open ? null : ids[opts.staff ?? PRIYA],
      start,
      end,
      break_minutes: 0,
    }),
    "add shift",
  );
  await must(
    api("manager", "POST", `${v}/roster/publish`, { week: mondayOf(day) }),
    "publish",
  );
  return { id: shift.external_id as string, day, start, end };
}

export async function cancelShift(id: string) {
  const v = await venuePath();
  await api("manager", "POST", `${v}/roster/shifts/${id}/cancel`);
}

/** The checklist that was issued for a shift (the closing list), once the week is published. */
export async function listForShift(
  shiftId: string,
  day?: string,
): Promise<string> {
  const v = await venuePath();
  // Narrow to the shift's own day when known: the demo staff member accumulates hundreds of lists over many runs.
  const range = day ? `from=${day}&to=${day}` : "from=2026-01-01&to=2035-12-31";
  const lists = await must(
    api("staff", "GET", `${v}/workflows/me/lists?${range}&limit=200`),
    "lists",
  );
  const hit = (
    lists.items as { id: string; name: string; shift_external_id: string }[]
  ).find((l) => l.shift_external_id === shiftId && l.name === "Closing");
  if (!hit) throw new Error("no list was issued for the shift");
  return hit.id;
}

/** Make sure the staff login is not clocked in (a leftover from another run). */
export async function clockedOut() {
  const v = await venuePath();
  const state = await must(api("staff", "GET", `${v}/me/clock`), "clock");
  if (state.clocked_in) await api("staff", "POST", `${v}/me/clock-out`, {});
}

export async function setRules(rules: Record<string, string | number | null>) {
  const v = await venuePath();
  return must(api("owner", "PATCH", `${v}/roster/rules`, { rules }), "rules");
}

export async function ruleValue(key: string): Promise<string | number> {
  const v = await venuePath();
  const page = await must(api("owner", "GET", `${v}/roster/rules`), "rules");
  return (page.items as { key: string; value: string | number }[]).find(
    (r) => r.key === key,
  )?.value as string | number;
}

/**
 * Like `watchForBrowserErrors`, but ignores the dev server's own overlay (next-devtools) and React's development build, which sets inline styles the
 * strict CSP blocks in `next dev` only. Everything the app itself loads is still checked.
 */
export function watchApp(page: import("@playwright/test").Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /Refused to|Content Security/i.test(m.text()) &&
      !/next-devtools|_development_|react-dom-client_development/.test(
        m.location().url,
      )
    )
      problems.push(`${m.location().url}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  return {
    expectNone: () => {
      if (problems.length > 0)
        throw new Error(`browser errors:\n${problems.join("\n")}`);
    },
  };
}

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

/** How the screens write a shift's day and span (same formatting as `src/server/format.ts`). */
export async function shownAs(id: string, _day: string) {
  const v = await venuePath();
  const shifts = await must(
    api(
      "staff",
      "GET",
      `${v}/me/shifts?from=${localDay(0)}&to=${localDay(14)}`,
    ),
    "my shifts",
  );
  const s = (
    shifts as { external_id: string; start: string; end: string }[]
  ).find((x) => x.external_id === id);
  if (!s) throw new Error("shift not in my shifts");
  return {
    day: new Intl.DateTimeFormat("en-AU", {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(s.start)),
    span: `${time(s.start)} to ${time(s.end)}`,
  };
}

/** The offer made when a shift is put in the pool. */
export async function dropShift(id: string): Promise<string> {
  const v = await venuePath();
  const offer = await must(
    api("staff", "POST", `${v}/me/shifts/${id}/drop`, {}),
    "drop",
  );
  return offer.id as string;
}

/** Staff asks for leave on a far-off day and a manager answers it: the staff login gets one notice and one request. */
export async function leaveDecided(approve: boolean, note?: string) {
  const v = await venuePath();
  const day = new Date(
    Date.UTC(2030, 0, 1) + Math.floor(Math.random() * 3000) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const made = await must(
    api("staff", "POST", `${v}/me/requests/leave`, {
      start_date: day,
      end_date: day,
      reason: "e2e",
    }),
    "leave",
  );
  await must(
    api(
      "manager",
      "POST",
      `${v}/requests/${made.id}/${approve ? "approve" : "reject"}`,
      note ? { note } : {},
    ),
    "decide",
  );
  return made.id as string;
}

export async function noticeTotals() {
  const v = await venuePath();
  const n = await must(
    api("staff", "GET", `${v}/workflows/notifications?limit=1`),
    "notices",
  );
  return { total: n.total as number, unread: n.unread as number };
}

/** Offer an open shift to the people who could work it (the venue's pickup rule decides the mode). */
export async function offerOpenShift(id: string): Promise<ApiAnswer> {
  const v = await venuePath();
  return api("manager", "POST", `${v}/roster/shifts/${id}/offer`, {});
}

export async function publishWeekOf(day: string) {
  const v = await venuePath();
  await must(
    api("manager", "POST", `${v}/roster/publish`, { week: mondayOf(day) }),
    "publish",
  );
}
