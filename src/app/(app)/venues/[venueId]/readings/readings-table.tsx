"use client";

import { Link } from "@astryxdesign/core/Link";
import { Table } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import type { ReadingRow } from "./rows";

type Row = ReadingRow & Record<string, unknown>;

const columns = [
  { key: "day", header: "Day" },
  { key: "time", header: "Time" },
  { key: "check", header: "Check" },
  { key: "reading", header: "Reading" },
  { key: "allowed", header: "Allowed" },
  { key: "result", header: "Result" },
  { key: "by", header: "Taken by" },
];

/** The readings table. The Follow-up cell is a link to the follow-up the reading raised (a cell with a link needs the browser). */
export function ReadingsTable({
  venueId,
  rows,
}: {
  venueId: string;
  rows: ReadingRow[];
}) {
  return (
    <Table<Row>
      data={rows as Row[]}
      columns={[
        ...columns,
        {
          key: "followUp",
          header: "Follow-up",
          renderCell: (r: Row) =>
            r.followUpPath ? (
              <Link href={`/venues/${venueId}${r.followUpPath}`}>
                {r.followUp}
              </Link>
            ) : (
              <Text type="supporting" color="secondary">
                {r.result === "Out of range" ? "None" : ""}
              </Text>
            ),
        },
      ]}
      idKey="id"
      density="compact"
      textOverflow="wrap"
    />
  );
}
