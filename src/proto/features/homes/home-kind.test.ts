import { describe, expect, test } from "bun:test";
import { personas } from "../../fixtures/personas";
import { homeKindFor, showsMoneyGlance } from "./home-kind";

describe("homeKindFor", () => {
  test("each persona", () => {
    expect(homeKindFor(personas.owner, null)).toBe("owner");
    expect(homeKindFor(personas.partner, "management")).toBe("owner");
    expect(homeKindFor(personas["manager-money"], null)).toBe("manager");
    expect(homeKindFor(personas.manager, null)).toBe("manager");
    expect(homeKindFor(personas.staff, null)).toBe("staff");
    expect(homeKindFor(personas.bookkeeper, null)).toBe("bookkeeper");
  });
  test("multi follows mode", () => {
    expect(homeKindFor(personas.multi, null)).toBe("staff");
    expect(homeKindFor(personas.multi, "staff")).toBe("staff");
    expect(homeKindFor(personas.multi, "management")).toBe("manager");
  });
  test("manager without money rights has no money glance", () => {
    expect(showsMoneyGlance(personas.manager)).toBe(false);
    expect(showsMoneyGlance(personas["manager-money"])).toBe(true);
  });
});
