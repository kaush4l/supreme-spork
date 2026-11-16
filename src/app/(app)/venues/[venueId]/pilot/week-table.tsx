"use client";

import { Table } from "@astryxdesign/core/Table";
import type { WeekRow } from "./words";

type Row = WeekRow & Record<string, unknown>;

export function WeekTable({
  rows,
  columns,
}: {
  rows: WeekRow[];
  columns: { key: string; header: string }[];
}) {
  return (
    <Table<Row>
      data={rows as Row[]}
      columns={[{ key: "week", header: "Week starting" }, ...columns]}
      idKey="id"
      density="compact"
      textOverflow="wrap"
    />
  );
}
