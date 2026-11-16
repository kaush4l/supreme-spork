import { describe, expect, test } from "bun:test";
import {
  closedWords,
  followUpWords,
  kindWords,
  ownerWords,
  pickState,
  stateWords,
} from "./words";

describe("follow-up words", () => {
  test("the filter defaults to open", () => {
    expect(pickState(undefined)).toBe("open");
    expect(pickState("nonsense")).toBe("open");
    expect(pickState("done")).toBe("done");
    expect(pickState("cancelled")).toBe("cancelled");
    expect(pickState("all")).toBe("all");
  });
  test("states and kinds are plain words", () => {
    expect(stateWords("open")).toBe("Open");
    expect(stateWords("cancelled")).toBe("Cancelled");
    expect(kindWords("out_of_range")).toContain("outside its limits");
    expect(kindWords("list_missed")).toContain("not finished");
    expect(kindWords("zzz")).toBe("A check failed");
  });
  test("the readings cell says the state in words, empty when none", () => {
    expect(followUpWords("open")).toBe("Follow-up open");
    expect(followUpWords("done")).toBe("Follow-up done");
    expect(followUpWords("cancelled")).toBe("Follow-up cancelled");
    expect(followUpWords(null)).toBe("");
    expect(followUpWords(undefined)).toBe("");
  });
  test("an owner is a name or nobody", () => {
    expect(ownerWords("Priya Nair")).toBe("Priya Nair");
    expect(ownerWords(null)).toBe("Nobody yet");
    expect(ownerWords("  ")).toBe("Nobody yet");
  });
  test("closed words name who", () => {
    expect(closedWords("done", "Maya Chen")).toBe("Marked done by Maya Chen");
    expect(closedWords("cancelled", null)).toBe("Cancelled by someone");
  });
});
