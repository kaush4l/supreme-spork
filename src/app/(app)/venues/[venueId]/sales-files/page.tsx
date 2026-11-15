import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { fetchSalesFileQueue } from "@/server/data/sales-files";
import { UploadForm } from "./upload-form";
import { mayWriteSales } from "./write-roles";

export const metadata = { title: "Sales files" };

const TYPE_WORDS: Record<string, string> = {
  sales_report: "Sales export",
  statement: "Delivery statement",
};

export default async function SalesFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ status?: string; offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const status = query.status === "all" ? "all" : "check";
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/sales-files`;
  const [page, rights] = await Promise.all([
    fetchSalesFileQueue(
      principal.accessToken,
      venueId,
      status,
      offset,
      `${here}?status=${status}`,
    ),
    myRights(principal.accessToken, venueId, here),
  ]);
  const base = `${here}?status=${status}`;
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Sales files</Heading>
      {mayWriteSales(rights.roles) ? <UploadForm venueId={venueId} /> : null}
      <Heading level={2}>
        {status === "all" ? "All files" : "Files that need a check"}
      </Heading>
      <Link href={`${here}?status=${status === "all" ? "check" : "all"}`}>
        {status === "all" ? "Show only files to check" : "Show all files"}
      </Link>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {status === "all"
            ? "No sales files yet."
            : "No sales files need a check."}
        </Text>
      ) : null}
      {page.items.map((f) => (
        <Card key={f.document_id} padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Heading level={3}>
              <Link href={`${here}/${f.document_id}`}>
                {f.filename ?? "Sales file"}
              </Link>
            </Heading>
            <Text type="body">
              {f.type ? `${TYPE_WORDS[f.type] ?? f.type}: ` : ""}
              {f.label}, {f.rows_read} rows read
            </Text>
            <Text type="supporting" color="secondary">
              {f.help}
            </Text>
            {f.reasons.map((r) => (
              <Text key={r} type="supporting" color="secondary">
                {r}
              </Text>
            ))}
          </VStack>
        </Card>
      ))}
      {offset > 0 ? (
        <Link href={`${base}&offset=${Math.max(0, offset - page.limit)}`}>
          Earlier ones
        </Link>
      ) : null}
      {offset + page.items.length < page.total ? (
        <Link href={`${base}&offset=${offset + page.limit}`}>More</Link>
      ) : null}
    </VStack>
  );
}
