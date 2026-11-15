import { formatDay, formatMoney, formatTime } from "@/server/format";

/** One column the API says to show for a source row. Pure: it formats, it never works out a figure. */
export type Column = {
  key: string;
  label: string;
  kind: "text" | "money_cents" | "date" | "datetime" | "number" | "percent";
};
export type Cell = { label: string; text: string };

/** One value in the way its column's kind says; an empty value is `null`. */
export function cellText(
  kind: Column["kind"],
  value: unknown,
  tz: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (kind === "money_cents" && typeof value === "number")
    return formatMoney(value);
  if (kind === "datetime" && typeof value === "string")
    return `${formatDay(value, tz)}, ${formatTime(value, tz)}`;
  if (kind === "percent") return `${value}%`;
  return String(value);
}

/** The cells of one row, in the API's column order; empty values are left out. */
export function rowCells(
  columns: Column[],
  row: Record<string, unknown>,
  tz: string,
): Cell[] {
  return columns.flatMap((c) => {
    const text = cellText(c.kind, row[c.key], tz);
    return text === null ? [] : [{ label: c.label, text }];
  });
}
