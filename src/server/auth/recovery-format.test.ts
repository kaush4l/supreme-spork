import { describe, expect, test } from "bun:test";
import { cleanCode, looksLikeCode, showCode } from "./recovery-format";

describe("recovery code text", () => {
  test("is shown in groups of four", () => {
    expect(showCode("abcdefghijklmnop")).toBe("abcd-efgh-ijkl-mnop");
    expect(showCode("abcde")).toBe("abcd-e");
  });
  test("is cleaned of spaces, dashes and capitals", () => {
    expect(cleanCode(" ABCD-efgh ijkl-MNOP ")).toBe("abcdefghijklmnop");
  });
  test("is checked for its alphabet and length", () => {
    expect(looksLikeCode("abcd-efgh-ijkl-mnop")).toBe(true);
    expect(looksLikeCode("123456")).toBe(false);
    expect(looksLikeCode("abcd-efgh-ijkl-mn01")).toBe(false);
  });
});
