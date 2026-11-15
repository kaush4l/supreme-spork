import { expect, test } from "bun:test";
import {
  entryLine,
  mayChange,
  mayEnter,
  mayReadReport,
  seesEveryone,
} from "./who";

test("the bookkeeper reads but does not record", () => {
  expect(mayEnter(["bookkeeper"])).toBe(false);
  expect(seesEveryone(["bookkeeper"])).toBe(true);
  expect(mayReadReport(["bookkeeper"])).toBe(true);
});

test("staff record, see their own and get no report", () => {
  expect(mayEnter(["staff"])).toBe(true);
  expect(seesEveryone(["staff"])).toBe(false);
  expect(mayReadReport(["staff"])).toBe(false);
});

test("who may change an entry", () => {
  expect(mayChange(["manager"], false)).toBe(true);
  expect(mayChange(["staff"], true)).toBe(true);
  expect(mayChange(["staff"], false)).toBe(false);
  expect(mayChange(["bookkeeper"], true)).toBe(false);
});

test("an entry line names the unit", () => {
  expect(
    entryLine({
      qty: 2,
      unit: "kg",
      item_kind: "ingredient",
      reason_label: "Spoiled",
    }),
  ).toBe("2 kg, spoiled");
  expect(
    entryLine({
      qty: 1,
      unit: "each",
      item_kind: "menu_item",
      reason_label: "Dropped or spilled",
    }),
  ).toBe("1 portion, dropped or spilled");
});
