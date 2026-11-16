"use client";

import { Table } from "@astryxdesign/core/Table";
import type { SummaryRow } from "./rows";

type Row = SummaryRow & Record<string, unknown>;

const columns = [
  { key: "name", header: "Person" },
  { key: "hours", header: "Hours worked" },
  { key: "rate", header: "Pay rate" },
  { key: "cost", header: "Cost of those hours" },
  { key: "cash", header: "Cash paid" },
  { key: "waiting", header: "Not yet confirmed" },
  { key: "difference", header: "Cash paid minus cost" },
];

export function PeopleTable({ rows }: { rows: SummaryRow[] }) {
  return (
    <Table<Row>
      data={rows as Row[]}
      columns={columns}
      idKey="id"
      density="compact"
      textOverflow="wrap"
    />
  );
}
