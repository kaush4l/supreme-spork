import { describe, expect, test } from "bun:test";
import { isSettled, replyWords, wallFrom } from "./words";

const tz = "Australia/Sydney";

describe("replyWords", () => {
  test("no answer yet", () => {
    expect(replyWords(null, tz)).toBeNull();
  });
  test("accept and decline", () => {
    expect(replyWords({ response: "accept" }, tz)).toBe(
      "You said you can work this.",
    );
    expect(replyWords({ response: "decline", reason: "sick" }, tz)).toContain(
      "Reason: sick",
    );
  });
  test("a proposal waits, then is decided", () => {
    const base = {
      response: "propose",
      proposed_start: "2037-06-02T01:00:00+00:00",
      proposed_end: "2037-06-02T05:00:00+00:00",
    };
    expect(replyWords(base, tz)).toContain("Waiting for your manager");
    expect(replyWords({ ...base, decision: "approved" }, tz)).toContain(
      "agreed",
    );
    expect(replyWords({ ...base, decision: "rejected" }, tz)).toContain(
      "stays as drafted",
    );
  });
  test("a pick-up", () => {
    expect(replyWords({ response: "pickup", decision: "approved" }, tz)).toBe(
      "You picked this shift up.",
    );
    expect(replyWords({ response: "pickup" }, tz)).toContain("Waiting");
  });
  test("an unknown answer says nothing", () => {
    expect(replyWords({ response: "later" }, tz)).toBeNull();
  });
});

test("isSettled follows the decision", () => {
  expect(isSettled(null)).toBe(false);
  expect(isSettled({ response: "propose", decision: null })).toBe(false);
  expect(isSettled({ response: "propose", decision: "approved" })).toBe(true);
});

test("wallFrom accepts only a real date and time", () => {
  expect(wallFrom("2037-06-02", "10:30")).toBe("2037-06-02T10:30");
  expect(wallFrom("2037-06-02", "10am")).toBeNull();
  expect(wallFrom("02/06/2037", "10:30")).toBeNull();
});
