import { describe, expect, test } from "bun:test";
import {
  audienceLine,
  formProblem,
  noLoginLine,
  readLine,
  receiptWords,
  statusWords,
} from "./words";

describe("words", () => {
  test("status and receipt words", () => {
    expect(statusWords("active")).toBe("Sent");
    expect(statusWords("withdrawn")).toBe("Withdrawn");
    expect(statusWords("zzz")).toBe("zzz");
    expect(receiptWords("no_login")).toBe("No app login");
    expect(receiptWords("unread")).toBe("Not read yet");
  });
  test("read line uses the told count", () => {
    expect(readLine({ read_count: 8, told_count: 11, no_login_count: 2 })).toBe(
      "Read by 8 of 11",
    );
    expect(readLine({ read_count: 0, told_count: 0, no_login_count: 5 })).toBe(
      "Nobody has an app login to be told.",
    );
  });
  test("no login line", () => {
    const c = { read_count: 0, told_count: 3, no_login_count: 0 };
    expect(noLoginLine(c)).toBeNull();
    expect(noLoginLine({ ...c, no_login_count: 1 })).toContain("1 person");
    expect(noLoginLine({ ...c, no_login_count: 4 })).toContain("4 people");
  });
  test("audience line", () => {
    expect(
      audienceLine({ audience_kind: "everyone", audience_labels: [] }),
    ).toBe("Everyone");
    expect(
      audienceLine({
        audience_kind: "positions",
        audience_labels: ["Cook", "Bar"],
      }),
    ).toBe("Positions: Cook, Bar");
    expect(audienceLine({ audience_kind: "groups", audience_labels: [] })).toBe(
      "Groups",
    );
  });
  test("form problems", () => {
    const ok = { title: "A", body: "B", kind: "everyone" as const, ids: [] };
    expect(formProblem(ok)).toBeNull();
    expect(formProblem({ ...ok, title: " " })).toBe("Write a title.");
    expect(formProblem({ ...ok, body: "" })).toBe("Write the message.");
    expect(formProblem({ ...ok, kind: "positions" })).toBe(
      "Choose who this is for.",
    );
    expect(formProblem({ ...ok, kind: "positions", ids: ["Cook"] })).toBeNull();
  });
});
