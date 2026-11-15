import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchQuestions, QUESTION_STATUSES } from "@/server/data/bank";

export const metadata = { title: "Bank questions" };

const STATUS_WORDS: Record<string, string> = {
  open: "Waiting",
  answered: "Answered",
  dismissed: "Set aside",
  all: "All",
};

export default async function BankPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ status?: string; offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const status =
    QUESTION_STATUSES.find((s) => s === query.status) ?? ("open" as const);
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/bank`;
  const page = await fetchQuestions(
    principal.accessToken,
    venueId,
    status,
    offset,
    here,
  );
  const base = `${here}?status=${status}`;
  const first = page.items[0];

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Bank questions</Heading>
      <HStack gap={3} wrap="wrap">
        {QUESTION_STATUSES.map((s) => (
          <Link key={s} href={`${here}?status=${s}`}>
            {s === status ? `${STATUS_WORDS[s]} (here)` : STATUS_WORDS[s]}
          </Link>
        ))}
      </HStack>
      <HStack gap={3} wrap="wrap">
        <Link href={`${here}/categories`}>Categories</Link>
        <Link href={`${here}/files`}>Bank files</Link>
      </HStack>
      <Text type="body">
        {page.total} {STATUS_WORDS[status].toLowerCase()}, oldest first.
      </Text>
      {status === "open" && first ? (
        <Link href={`${here}/${first.id}`}>
          Start answering from the oldest
        </Link>
      ) : null}
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {status === "open"
            ? "No bank questions are waiting."
            : "Nothing to show here."}
        </Text>
      ) : null}
      {page.items.map((q) => (
        <Card key={q.id} padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Heading level={3}>
              <Link href={`${here}/${q.id}`}>{q.prompt}</Link>
            </Heading>
            <Text type="supporting" color="secondary">
              {q.label}
              {q.date ? `, ${q.date}` : ""}
              {q.payee_text ? `, ${q.payee_text}` : ""}
            </Text>
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
