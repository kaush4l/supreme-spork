import { centsToInput, dollarsToCents } from "@/server/data/money-input";

/** What a person typed for one line. Money is dollars text, the quantity is a plain number. */
export type LineText = {
  /** The line number (starts at 1); 0 for a new line being keyed in. */
  line: number;
  description: string;
  qty: string;
  unitText: string;
  unitPrice: string;
  lineTotal: string;
  drop: boolean;
};

export type Errors = Record<string, string>;

const MONEY = "Write the amount like 12.50.";
const QTY = "Write the quantity as a number, like 2 or 1.5.";

function money(text: string, field: string, errors: Errors) {
  const cents = dollarsToCents(text);
  if (cents === "invalid") {
    errors[field] = MONEY;
    return null;
  }
  return cents;
}

function quantity(text: string, field: string, errors: Errors) {
  const clean = text.trim();
  if (clean === "") return null;
  const n = Number(clean);
  if (!Number.isFinite(n) || n <= 0 || !/^\d+(\.\d+)?$/.test(clean)) {
    errors[field] = QTY;
    return null;
  }
  return n;
}

/** The messages that belong to line `n` (a field error from the backend is `lines[n].qty` and so on). */
export function lineErrors(errors: Errors, n: number): string[] {
  return Object.entries(errors)
    .filter(([key]) => key.startsWith(`lines[${n}].`))
    .map(([, message]) => message);
}

export type KeyBody = {
  supplier?: string;
  delivery_date: string;
  invoice_no?: string;
  total_cents?: number;
  lines: {
    description: string;
    qty?: number;
    unit_text?: string;
    unit_price_cents?: number;
    total_cents?: number;
  }[];
};

/** Turn the key-in form into what the backend wants. Only typing mistakes are caught here; the backend checks the sums. */
export function keyBody(form: {
  supplier: string;
  deliveryDate: string;
  invoiceNo: string;
  total: string;
  lines: LineText[];
}): { ok: true; body: KeyBody } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const total = money(form.total, "total_cents", errors);
  const lines = form.lines.map((l, i) => {
    const n = i + 1;
    const qty = quantity(l.qty, `lines[${n}].qty`, errors);
    const price = money(l.unitPrice, `lines[${n}].unit_price_cents`, errors);
    const sum = money(l.lineTotal, `lines[${n}].total_cents`, errors);
    return {
      description: l.description.trim(),
      ...(qty === null ? {} : { qty }),
      ...(l.unitText.trim() ? { unit_text: l.unitText.trim() } : {}),
      ...(price === null ? {} : { unit_price_cents: price }),
      ...(sum === null ? {} : { total_cents: sum }),
    };
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      ...(form.supplier.trim() ? { supplier: form.supplier.trim() } : {}),
      delivery_date: form.deliveryDate.trim(),
      ...(form.invoiceNo.trim() ? { invoice_no: form.invoiceNo.trim() } : {}),
      ...(total === null ? {} : { total_cents: total }),
      lines,
    },
  };
}

export type ChangeBody = {
  supplier?: string;
  delivery_date?: string;
  invoice_no?: string;
  total_cents?: number;
  lines: Record<
    number,
    {
      description?: string;
      qty?: number;
      unit_price_cents?: number;
      total_cents?: number;
    }
  >;
  drop_lines: number[];
};

export type Original = {
  supplier: string | null;
  delivery_date: string | null;
  invoice_no: string | null;
  total_cents: number | null;
  lines: {
    line: number;
    description: string | null;
    qty: number | null;
    unit_price_cents: number | null;
    total_cents: number | null;
  }[];
};

/** The text boxes of the change form start as what the docket holds now. */
export function startingText(o: Original): LineText[] {
  return o.lines.map((l) => ({
    line: l.line,
    description: l.description ?? "",
    qty: l.qty === null ? "" : String(l.qty),
    unitText: "",
    unitPrice: centsToInput(l.unit_price_cents),
    lineTotal: centsToInput(l.total_cents),
    drop: false,
  }));
}

/** Only what the person changed is sent; a box left empty is left alone. */
export function changeBody(
  original: Original,
  form: {
    supplier: string;
    deliveryDate: string;
    invoiceNo: string;
    total: string;
    lines: LineText[];
  },
): { ok: true; body: ChangeBody } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const body: ChangeBody = { lines: {}, drop_lines: [] };
  const differs = (now: string, was: string | null) =>
    now.trim() !== "" && now.trim() !== (was ?? "");
  if (differs(form.supplier, original.supplier))
    body.supplier = form.supplier.trim();
  if (differs(form.deliveryDate, original.delivery_date))
    body.delivery_date = form.deliveryDate.trim();
  if (differs(form.invoiceNo, original.invoice_no))
    body.invoice_no = form.invoiceNo.trim();
  if (form.total.trim() !== centsToInput(original.total_cents)) {
    const cents = money(form.total, "total_cents", errors);
    if (cents !== null) body.total_cents = cents;
  }
  for (const text of form.lines) {
    const was = original.lines.find((l) => l.line === text.line);
    if (!was) continue;
    if (text.drop) {
      body.drop_lines.push(text.line);
      continue;
    }
    const edit: ChangeBody["lines"][number] = {};
    if (differs(text.description, was.description))
      edit.description = text.description.trim();
    if (text.qty.trim() !== (was.qty === null ? "" : String(was.qty))) {
      const qty = quantity(text.qty, `lines[${text.line}].qty`, errors);
      if (qty !== null) edit.qty = qty;
    }
    if (text.unitPrice.trim() !== centsToInput(was.unit_price_cents)) {
      const c = money(
        text.unitPrice,
        `lines[${text.line}].unit_price_cents`,
        errors,
      );
      if (c !== null) edit.unit_price_cents = c;
    }
    if (text.lineTotal.trim() !== centsToInput(was.total_cents)) {
      const c = money(
        text.lineTotal,
        `lines[${text.line}].total_cents`,
        errors,
      );
      if (c !== null) edit.total_cents = c;
    }
    if (Object.keys(edit).length > 0) body.lines[text.line] = edit;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const nothing =
    Object.keys(body.lines).length === 0 &&
    body.drop_lines.length === 0 &&
    body.supplier === undefined &&
    body.delivery_date === undefined &&
    body.invoice_no === undefined &&
    body.total_cents === undefined;
  if (nothing)
    return { ok: false, errors: { form: "Change something first." } };
  return { ok: true, body };
}
