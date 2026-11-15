import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchFile } from "@/server/data/bank";
import { formatMoney } from "@/server/format";
import { ReviewButtons } from "./review-buttons";

export const metadata = { title: "Bank file" };

export default async function BankFilePage({
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
  const f = await fetchFile(
    principal.accessToken,
    venueId,
    documentId,
    `/venues/${venueId}/bank/files/${documentId}`,
  );
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/bank/files`}>Back to bank files</Link>
      <Heading level={1}>{f.filename ?? "Bank file"}</Heading>
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
          <Text type="body">
            Money in {formatMoney(f.money_in_cents)}, money out{" "}
            {formatMoney(f.money_out_cents)}
          </Text>
          <Text type="supporting" color="secondary">
            {f.rows_total} rows read, {f.questions_open} questions open.
          </Text>
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
      <ReviewButtons
        venueId={venueId}
        documentId={documentId}
        waiting={f.status === "needs_check"}
      />
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
          Line {r.line}: {r.date}, {r.description},{" "}
          {formatMoney(r.amount_cents)}
        </Text>
      ))}
    </VStack>
  );
}
