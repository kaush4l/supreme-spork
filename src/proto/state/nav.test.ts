import { describe, expect, test } from "bun:test";
import { personas } from "../fixtures/personas";
import type { PersonaId } from "../types";
import { navFor, routeAllowed } from "./nav";

const keys = (id: PersonaId, mode: "staff" | "management") =>
  navFor(personas[id], mode).map((x) => x.key);

describe("navFor", () => {
  test("staff", () => {
    expect(keys("staff", "staff")).toEqual(["home", "shifts", "inbox", "me"]);
    expect(navFor(personas.staff, "staff")[0].label).toBe("Today");
  });
  test("money managers see Money", () => {
    for (const id of ["owner", "partner", "manager-money"] as const) {
      expect(keys(id, "management")).toEqual([
        "home",
        "team",
        "operations",
        "money",
      ]);
    }
  });
  test("manager without money has Inbox as 4th", () => {
    expect(keys("manager", "management")).toEqual([
      "home",
      "team",
      "operations",
      "inbox",
    ]);
  });
  test("bookkeeper", () => {
    expect(keys("bookkeeper", "management")).toEqual([
      "home",
      "money",
      "inbox",
      "me",
    ]);
  });
  test("cash.record alone does not expose Money overview", () => {
    const p = {
      ...personas.manager,
      capabilities: ["ops.manage", "cash.record"] as never,
    };
    expect(navFor(p, "management").some((x) => x.key === "money")).toBe(false);
    expect(routeAllowed(p, "management", "money")).toBe(false);
  });
  test("no forbidden destinations", () => {
    expect(routeAllowed(personas.manager, "management", "money")).toBe(false);
    expect(routeAllowed(personas.bookkeeper, "management", "operations")).toBe(
      false,
    );
    expect(routeAllowed(personas.bookkeeper, "management", "team")).toBe(false);
    expect(routeAllowed(personas.staff, "staff", "team")).toBe(false);
    expect(routeAllowed(personas.staff, "staff", "money")).toBe(false);
    for (const id of Object.keys(personas) as PersonaId[]) {
      for (const mode of personas[id].modes) {
        for (const dest of navFor(personas[id], mode)) {
          expect(routeAllowed(personas[id], mode, dest.segment)).toBe(true);
        }
        expect(navFor(personas[id], mode)).toHaveLength(4);
      }
    }
  });
  test("multi switches modes", () => {
    expect(keys("multi", "staff")).toEqual(["home", "shifts", "inbox", "me"]);
    expect(keys("multi", "management")).toEqual([
      "home",
      "team",
      "operations",
      "inbox",
    ]);
  });
  test("mode not allowed falls back to default mode", () => {
    expect(keys("staff", "management")).toEqual([
      "home",
      "shifts",
      "inbox",
      "me",
    ]);
  });
});
