import { describe, expect, test } from "bun:test";
import { allDockets, DOCKET_COUNTS } from "./dockets";
import { bookkeeperHome, managerToday, ownerHome, staffToday } from "./home";
import {
  INBOX_PAGE_SIZE,
  initialInbox,
  offerFilledByOther,
  resolveByOtherManager,
} from "./inbox";
import { getPersona, personas } from "./personas";
import { initialRoster, isOvernight, validateDraft } from "./roster";
import { staff } from "./staff";
import { REFERENCE_NOW, startOfWeek } from "./time";
import { venues } from "./venues";

function keys(o: unknown, acc: string[] = []): string[] {
  if (Array.isArray(o)) for (const v of o) keys(v, acc);
  else if (o && typeof o === "object")
    for (const [k, v] of Object.entries(o)) {
      acc.push(k);
      keys(v, acc);
    }
  return acc;
}

describe("fixtures", () => {
  test("counts", () => {
    expect(staff.length).toBe(250);
    expect(new Set(staff.map((s) => s.id)).size).toBe(250);
    expect(staff.some((s) => s.name.length > 45)).toBe(true);
    expect(allDockets("v-harbour", 120).length).toBe(120);
    for (const n of DOCKET_COUNTS)
      expect(allDockets("v-harbour", n).length).toBe(n);
    expect(venues.map((v) => v.id)).toEqual([
      "v-harbour",
      "v-perth",
      "v-empty",
    ]);
    expect(REFERENCE_NOW).toBe("2026-11-17T10:30:00+11:00");
    expect(startOfWeek("2026-11-17")).toBe("2026-11-16");
  });

  test("personas capabilities", () => {
    expect(getPersona("manager").capabilities).toContain("cash.record");
    expect(getPersona("manager").capabilities).not.toContain("money.overview");
    const bk = getPersona("bookkeeper").capabilities;
    expect(bk).toContain("money.dockets.read");
    expect(bk).toContain("money.labour.aggregate");
    expect(getPersona("staff").capabilities.sort()).toEqual([
      "docket.upload",
      "staff.today",
    ]);
    expect(Object.keys(personas).length).toBe(7);
  });

  test("inbox pages, ids, determinism", () => {
    const a = initialInbox("u-staff", "v-harbour");
    expect(a.length).toBeGreaterThanOrEqual(45);
    expect(Math.ceil(a.length / INBOX_PAGE_SIZE)).toBeGreaterThanOrEqual(3);
    expect(a.every((i) => i.id === `${i.recipientId}:${i.subjectId}`)).toBe(
      true,
    );
    expect(a.some((i) => !i.read)).toBe(true);
    expect(a.some((i) => i.requiresAck)).toBe(true);
    expect(a.some((i) => i.subjectState === "removed")).toBe(true);
    expect(a.some((i) => i.subjectState === "revoked")).toBe(true);
    expect(initialInbox("u-staff", "v-harbour")).toEqual(a);
  });

  test("outcome helpers keep read state", () => {
    const a = initialInbox("u-staff", "v-harbour");
    const t = a.find(
      (i) => i.tab === "action" && !i.read && i.subjectState === "open",
    );
    expect(t).toBeDefined();
    const b = resolveByOtherManager(a, t?.subjectId as string);
    const c = offerFilledByOther(a, t?.subjectId as string);
    for (const arr of [b, c]) {
      const x = arr.find((i) => i.subjectId === t?.subjectId);
      expect(x?.subjectState).toBe("resolved");
      expect(x?.outcome).toBeDefined();
      expect(x?.read).toBe(false);
    }
    expect(
      a.find((i) => i.subjectId === t?.subjectId)?.outcome,
    ).toBeUndefined();
  });

  test("owner home: busy total 120 with 100 supplied, lower bound, preview cap", () => {
    const h = ownerHome("v-harbour", "busy").urgent;
    if (h.status !== "ok") throw new Error("expected ok");
    expect(h.data.totalCount).toBe(120);
    expect(h.data.suppliedCount).toBe(100);
    expect(h.data.preview.length).toBe(5);
    const lb = ownerHome("v-perth", "busy").urgent;
    if (lb.status !== "ok") throw new Error("expected ok");
    expect(lb.data.totalIsLowerBound).toBe(true);
  });

  test("null (missing) is distinct from zero", () => {
    const p = ownerHome("v-harbour", "partial");
    if (p.lastWeekFinance.status !== "ok") throw new Error("expected ok");
    const labour = p.lastWeekFinance.data.metrics.find(
      (m) => m.key === "labour_cost",
    );
    expect(labour?.value).toBeNull();
    expect(p.lastWeekFinance.data.coverage.state).toBe("partial");
    const zero = p.lastWeekFinance.data.metrics.find(
      (m) => m.key === "cash_variance",
    );
    expect(zero?.value).toBe(0);
    expect(zero?.value).not.toBeNull();
    expect(p.upcomingObligations.status).toBe("error");
    expect(p.urgent.status).toBe("ok");
  });

  test("scenarios and hrefs", () => {
    expect(ownerHome("v-harbour", "denied").urgent.status).toBe("denied");
    expect(ownerHome("v-harbour", "loading").todaySummary.status).toBe(
      "loading",
    );
    const d = ownerHome("v-harbour", "default");
    if (d.todaySummary.status !== "ok" || d.lastWeekFinance.status !== "ok")
      throw new Error("ok");
    for (const m of [
      ...d.todaySummary.data.metrics,
      ...d.lastWeekFinance.data.metrics,
    ]) {
      expect(m.href.length).toBeGreaterThan(0);
      expect(m.coverage.periodLabel.length).toBeGreaterThan(0);
    }
    const s = ownerHome("v-harbour", "stale");
    if (s.lastWeekFinance.status !== "ok") throw new Error("ok");
    expect(s.lastWeekFinance.data.coverage.asOf < "2026-11-17").toBe(true);
    const e = ownerHome("v-empty", "default").urgent;
    if (e.status !== "ok") throw new Error("ok");
    expect(e.data.totalCount).toBe(0);
  });

  test("manager grouped issue keeps distinct failure separate", () => {
    const m = managerToday("v-harbour", "default").issues;
    if (m.status !== "ok") throw new Error("ok");
    expect(m.data.grouped[0]?.relatedIds).toEqual(["c-12", "e-4", "d-2"]);
    expect(m.data.distinctFailures.map((f) => f.id)).toEqual(["c-13"]);
    expect(managerToday("v-harbour", "partial").checks.status).toBe("error");
    expect(managerToday("v-harbour", "partial").staffingNow.status).toBe("ok");
  });

  test("staff today variants", () => {
    const g = (d: Parameters<typeof staffToday>[2]) => {
      const r = staffToday("v-harbour", "default", d).shifts;
      if (r.status !== "ok") throw new Error("ok");
      return r.data;
    };
    expect(g("missing_clock_out").clock.state).toBe("missing_clock_out");
    expect(g("overnight").currentShift?.overnight).toBe(true);
    expect(g("no_work").noWorkToday).toBe(true);
    expect(g("late_finish").lateFinish).toBe(true);
    expect(staffToday("v-harbour").docketUploadAllowed).toBe(true);
  });

  test("bookkeeper home has no named pay fields", () => {
    for (const sc of ["default", "busy", "partial", "stale"] as const) {
      const ks = keys(bookkeeperHome("v-harbour", sc));
      expect(ks.filter((k) => /rate|wage|salary|pay_rate/i.test(k))).toEqual(
        [],
      );
    }
    const l = bookkeeperHome("v-harbour").labourAggregate;
    if (l.status !== "ok") throw new Error("ok");
    expect(Object.keys(l.data).sort()).toEqual([
      "href",
      "periodLabel",
      "totalCents",
      "totalHours",
    ]);
  });

  test("roster: overnight valid, blocking and advisory, determinism", () => {
    const r = initialRoster("v-harbour", "2026-11-16");
    expect(initialRoster("v-harbour", "2026-11-16")).toEqual(r);
    const night = r.shifts.find((s) => s.id.endsWith("night1"));
    expect(night && isOvernight(night)).toBe(true);
    const issues = validateDraft(r);
    expect(issues.some((i) => i.shiftId === night?.id)).toBe(false);
    expect(issues.some((i) => i.severity === "blocking")).toBe(true);
    expect(issues.some((i) => i.severity === "advisory")).toBe(true);
    expect(r.shifts.some((s) => s.staffId === null)).toBe(true);
    expect(r.shifts.some((s) => s.leave)).toBe(true);
    expect(r.shifts.some((s) => s.changed)).toBe(true);
    const bad = {
      ...r,
      shifts: [
        { ...r.shifts[0], start: "2026-11-16T22:00", end: "2026-11-16T06:00" },
      ],
    } as typeof r;
    expect(validateDraft(bad)[0]?.severity).toBe("blocking");
  });

  test("dockets deterministic and D-0111 present", () => {
    expect(allDockets("v-harbour", 120)).toEqual(allDockets("v-harbour", 120));
    expect(allDockets("v-harbour", 120).some((d) => d.id === "D-0111")).toBe(
      true,
    );
  });
});
