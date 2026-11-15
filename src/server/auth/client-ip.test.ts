import { describe, expect, test } from "bun:test";
import { clientAddress } from "./client-ip";

const h = (values: Record<string, string>) => new Headers(values);

describe("clientAddress", () => {
  test("prefers the proxy's own header, then the first forwarded hop", () => {
    expect(
      clientAddress(
        h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }),
      ),
    ).toBe("203.0.113.7");
    expect(
      clientAddress(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.2" })),
    ).toBe("198.51.100.1");
    expect(clientAddress(h({ "x-real-ip": "2001:db8::1" }))).toBe(
      "2001:db8::1",
    );
  });

  test("forwards nothing that is not an address", () => {
    for (const bad of [
      "unknown",
      "1.2.3",
      "999.1.1.1",
      "1.2.3.4; drop",
      "<script>",
      "a".repeat(80),
      "",
      "1.2.3.4\r\nX-Evil: 1",
    ]) {
      expect(
        clientAddress(h({ "x-real-ip": bad.replace(/[\r\n]/g, " ") })),
      ).toBeNull();
    }
    expect(clientAddress(h({}))).toBeNull();
  });
});
