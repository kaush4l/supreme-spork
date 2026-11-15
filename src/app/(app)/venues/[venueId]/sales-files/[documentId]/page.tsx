import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { fetchSalesFile } from "@/server/data/sales-files";
import { formatMoney } from "@/server/format";
import { mayWriteSales } from "../write-roles";
import { ReviewButtons } from "./review-buttons";

export const metadata = { title: "Sales file" };

export default async function SalesFilePage({
  params,
}: {
  params: Promise<{ venueId: string; documentId: string }>;
}) {
  const { venueId, documentId } = await params;
  if (
    !z.uuid().safeParse(venueId).success ||
    !z.uuid().safeParse(documentId).success
  )
    notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/sales-files/${documentId}`;
  const [f, rights] = await Promise.all([
    fetchSalesFile(principal.accessToken, venueId, documentId, here),
    myRights(principal.accessToken, venueId, here),
  ]);
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/sales-files`}>Back to sales files</Link>
      <Heading level={1}>{f.filename ?? "Sales file"}</Heading>
      <Card padding={4}>
        <VStack gap={1} hAlign="stretch">
          <Text type="body">{f.label}</Text>
          <Text type="supporting" color="secondary">
            {f.help}
          </Text>
          {f.period_start ? (
            <Text type="body">
              {f.period_start} to {f.period_end}
            </Text>
          ) : null}
          <Text type="body">Sales {formatMoney(f.gross_cents)}</Text>
          {f.commissions > 0 ? (
            <Text type="body">
              {f.commissions} commission lines,{" "}
              {formatMoney(f.commission_cents)}
            </Text>
          ) : null}
          <Text type="supporting" color="secondary">
            {f.rows_total} rows read.
          </Text>
          {f.file_url ? (
            <Link href={f.file_url}>
              Open the file (link works for a few minutes)
            </Link>
          ) : null}
        </VStack>
      </Card>
      {f.reasons.length > 0 ? (
        <VStack gap={1} hAlign="stretch">
          <Heading level={2}>Why it was held back</Heading>
          {f.reasons.map((r) => (
            <Text key={r} type="body">
              {r}
            </Text>
          ))}
        </VStack>
      ) : null}
      {mayWriteSales(rights.roles) ? (
        <ReviewButtons
          venueId={venueId}
          documentId={documentId}
          waiting={f.status === "needs_check"}
        />
      ) : null}
      <Heading level={2}>
        Rows read{f.rows_shown < f.rows_total ? ` (first ${f.rows_shown})` : ""}
      </Heading>
      {f.rows.length === 0 ? (
        <Text type="supporting" color="secondary">
          No rows were read from this file.
        </Text>
      ) : null}
      {f.rows.map((r) => (
        <Text key={r.line} type="supporting" color="secondary">
          Line {r.line}: {r.trading_day ? `${r.trading_day}, ` : ""}
          {r.item}, {r.channel}, {r.qty} x, {formatMoney(r.gross_cents)}
          {r.discount_cents
            ? `, discount ${formatMoney(r.discount_cents)}`
            : ""}
          {r.void ? ", void" : ""}
        </Text>
      ))}
    </VStack>
  );
}
