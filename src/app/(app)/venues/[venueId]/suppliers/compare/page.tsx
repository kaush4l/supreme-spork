import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { supplierCompare } from "@/server/data/suppliers";
import { formatMoney } from "@/server/format";
import { WeekForm } from "./week-form";

export const metadata = { title: "Compare suppliers" };

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const { week } = await searchParams;
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/suppliers/compare`;
  const result = await supplierCompare(
    principal.accessToken,
    venueId,
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : undefined,
    here,
  );
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/suppliers`}>All suppliers</Link>
      <Heading level={1}>Compare suppliers</Heading>
      {result.ok ? (
        <>
          <WeekForm venueId={venueId} week={result.data.week_start} />
          <Text type="supporting" color="secondary">
            Eight weeks to {result.data.week_end}, from {result.data.from}.{" "}
            {result.data.basis}
          </Text>
          {result.data.comparisons.length === 0 ? (
            <Text type="supporting" color="secondary">
              No items were bought from two or more suppliers in this time.
            </Text>
          ) : (
            result.data.comparisons.map((c) => (
              <Card key={c.item_id} padding={4}>
                <VStack gap={2}>
                  <Heading level={3}>{c.item}</Heading>
                  <Text type="body">
                    Cheapest: {c.cheaper.supplier} at{" "}
                    {formatMoney(c.cheaper.price_cents)} per {c.unit}
                  </Text>
                  {c.same_price ? (
                    <Text type="supporting" color="secondary">
                      The suppliers charge the same.
                    </Text>
                  ) : (
                    c.dearer.map((d) => (
                      <Text key={d.supplier_id} type="body">
                        {d.supplier}: {formatMoney(d.price_cents)} per {c.unit}{" "}
                        ({formatMoney(d.diff_cents)} more). About{" "}
                        {formatMoney(d.weekly_cents)} a week at what you bought
                        in the last 4 weeks.
                      </Text>
                    ))
                  )}
                </VStack>
              </Card>
            ))
          )}
          {result.data.unmatched.length > 0 ? (
            <VStack gap={2} hAlign="stretch">
              <Heading level={2}>Could not be compared</Heading>
              <Text type="supporting" color="secondary">
                {result.data.unmatched_note}
              </Text>
              {result.data.unmatched.map((u) => (
                <Text
                  key={`${u.item}|${u.supplier}|${u.trading_day}`}
                  type="body"
                >
                  {u.item} ({u.supplier}): {u.reason}
                </Text>
              ))}
            </VStack>
          ) : null}
        </>
      ) : (
        <>
          <Banner status="error" title={result.message} />
          <WeekForm venueId={venueId} />
        </>
      )}
    </VStack>
  );
}
