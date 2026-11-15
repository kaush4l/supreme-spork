import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchCategories, fetchQuestion } from "@/server/data/bank";
import { formatMoney } from "@/server/format";
import { AnswerPanel } from "./answer-panel";

export const metadata = { title: "Bank question" };

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ venueId: string; questionId: string }>;
}) {
  const { venueId, questionId } = await params;
  if (
    !z.uuid().safeParse(venueId).success ||
    !z.uuid().safeParse(questionId).success
  )
    notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/bank/${questionId}`;
  const [q, categories] = await Promise.all([
    fetchQuestion(principal.accessToken, venueId, questionId, here),
    fetchCategories(principal.accessToken, venueId, here),
  ]);
  const ev = q.evidence;
  const answered = q.answer as {
    category_label?: string;
    note?: string;
  } | null;

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/bank`}>Back to questions</Link>
      <Heading level={1}>{q.summary ?? q.prompt}</Heading>
      <Text type="supporting" color="secondary">
        {q.label}. {q.help}
      </Text>
      {ev?.date ? (
        <Card padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Text type="body">Date: {ev.date}</Text>
            <Text type="body">
              Amount: {ev.amount_text}
              {ev.direction ? ` (${ev.direction})` : ""}
            </Text>
            <Text type="body">Bank wrote: {ev.payee_text}</Text>
            {ev.usual_category ? (
              <Text type="supporting" color="secondary">
                Usually filed as {ev.usual_category.label} (
                {ev.usual_category.times} times).
              </Text>
            ) : null}
            {ev.matching_docket ? (
              <Text type="supporting" color="secondary">
                May match: {ev.matching_docket.text}
              </Text>
            ) : null}
          </VStack>
        </Card>
      ) : null}
      {ev?.docket ? (
        <Card padding={4}>
          <Text type="body">
            Docket from {ev.docket.supplier ?? "a supplier"}
            {ev.docket.delivered_on ? ` dated ${ev.docket.delivered_on}` : ""}
            {ev.docket.total_cents != null
              ? ` for ${formatMoney(ev.docket.total_cents)}`
              : ""}
            .
          </Text>
        </Card>
      ) : null}
      {ev?.similar_rows && ev.similar_rows.length > 0 ? (
        <VStack gap={1} hAlign="stretch">
          <Heading level={2}>Earlier payments to the same payee</Heading>
          {ev.similar_rows.map((r) => (
            <Text
              key={`${r.date}-${r.amount_cents}`}
              type="supporting"
              color="secondary"
            >
              {r.date}, {r.amount_text}, {r.category_label ?? "not filed yet"}
            </Text>
          ))}
        </VStack>
      ) : null}
      {answered ? (
        <Text type="body">
          Answer: {answered.category_label ?? ""}
          {answered.note ? ` ${answered.note}` : ""}
        </Text>
      ) : null}
      <AnswerPanel
        venueId={venueId}
        questionId={questionId}
        status={q.status}
        kind={q.kind}
        usualCategory={ev?.usual_category?.name ?? null}
        categories={categories
          .filter((c) => c.active)
          .map((c) => ({ value: c.name, label: c.label }))}
        ruleOffer={q.rule_offer ?? null}
      />
    </VStack>
  );
}
