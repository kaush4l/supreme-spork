import { expect, test } from "bun:test";
import {
  changeBody,
  keyBody,
  lineErrors,
  type Original,
  startingText,
} from "./payload";

const original: Original = {
  supplier: "Smithfield Meats",
  delivery_date: "2026-10-21",
  invoice_no: "87329",
  total_cents: 5054,
  lines: [
    {
      line: 1,
      description: "Beef mince",
      qty: 6,
      unit_price_cents: 791,
      total_cents: 4746,
    },
    {
      line: 2,
      description: "Patties",
      qty: 2,
      unit_price_cents: 114,
      total_cents: 228,
    },
  ],
};
const base = (lines = startingText(original)) => ({
  supplier: "Smithfield Meats",
  deliveryDate: "2026-10-21",
  invoiceNo: "87329",
  total: "50.54",
  lines,
});

test("nothing changed is refused", () => {
  const r = changeBody(original, base());
  expect(r.ok).toBe(false);
});

test("only the changed fields are sent, money in cents", () => {
  const lines = startingText(original);
  lines[1] = { ...lines[1], unitPrice: "3.50", lineTotal: "7.00" } as never;
  const r = changeBody(original, { ...base(lines), total: "$53.46" });
  expect(r).toEqual({
    ok: true,
    body: {
      total_cents: 5346,
      lines: { 2: { unit_price_cents: 350, total_cents: 700 } },
      drop_lines: [],
    },
  });
});

test("a dropped line is listed and bad money is named by line", () => {
  const lines = startingText(original);
  lines[0] = { ...lines[0], drop: true } as never;
  lines[1] = { ...lines[1], qty: "two" } as never;
  const r = changeBody(original, base(lines));
  expect(r.ok).toBe(false);
  const ok = changeBody(original, base([{ ...lines[0], drop: true } as never]));
  expect(ok.ok && ok.body.drop_lines).toEqual([1]);
});

test("key in builds cents and finds typing mistakes", () => {
  const line = {
    line: 0,
    description: " Napkins ",
    qty: "2",
    unitText: "ea",
    unitPrice: "24",
    lineTotal: "",
    drop: false,
  };
  const r = keyBody({
    supplier: "Napoli Imports",
    deliveryDate: "2026-11-03",
    invoiceNo: "",
    total: "48",
    lines: [line],
  });
  expect(r).toEqual({
    ok: true,
    body: {
      supplier: "Napoli Imports",
      delivery_date: "2026-11-03",
      total_cents: 4800,
      lines: [
        {
          description: "Napkins",
          qty: 2,
          unit_text: "ea",
          unit_price_cents: 2400,
        },
      ],
    },
  });
  const bad = keyBody({
    supplier: "",
    deliveryDate: "",
    invoiceNo: "",
    total: "",
    lines: [{ ...line, unitPrice: "abc" }],
  });
  expect(bad.ok).toBe(false);
  if (!bad.ok)
    expect(lineErrors(bad.errors, 1)).toEqual(["Write the amount like 12.50."]);
});
