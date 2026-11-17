import { expect, test } from "bun:test";
import { filterShifts, parseRosterParams } from "./params";

const q = (s: string) => parseRosterParams(new URLSearchParams(s));

test("valid params are honoured", () => {
  const p = q("day=2026-11-18&view=agenda&filter=open");
  expect(p).toMatchObject({
    day: "2026-11-18",
    view: "agenda",
    filter: "open",
  });
  expect(p.notices).toEqual([]);
});
test("unsupported values give notices", () => {
  const p = q("day=soon&view=now&filter=bogus");
  expect(p.day).toBeNull();
  expect(p.view).toBeNull();
  expect(p.filter).toBeNull();
  expect(p.notices).toHaveLength(3);
});
test("filters", () => {
  const s = [
    { id: "a", staffId: null },
    { id: "b", staffId: "x", leave: true },
  ] as never;
  expect(filterShifts(s, "open", {}).map((x) => x.id)).toEqual(["a"]);
  expect(filterShifts(s, "leave", {}).map((x) => x.id)).toEqual(["b"]);
  expect(filterShifts(s, "changed", { b: "edited" }).map((x) => x.id)).toEqual([
    "b",
  ]);
  expect(filterShifts(s, null, {})).toHaveLength(2);
});
