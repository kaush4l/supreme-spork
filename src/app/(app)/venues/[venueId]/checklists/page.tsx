import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import {
  listPositions,
  listRules,
  listTemplates,
  starterLibrary,
} from "@/server/data/checklists";
import { staffOptions } from "@/server/data/timesheet";
import { RuleForm, RuleRow } from "./rules";
import { StarterCard } from "./starter-card";

export const metadata = { title: "Checklists" };

export const TIMING_WORDS: Record<string, string> = {
  shift_start: "when the shift starts",
  before_shift_end: "before the shift ends",
  fixed_time: "at a set time",
};

export default async function ChecklistsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/checklists`;
  const [templates, library, rules, positions, staff] = await Promise.all([
    listTemplates(token, venueId, here),
    starterLibrary(token, venueId, here),
    listRules(token, venueId, here),
    listPositions(token, venueId, here),
    staffOptions(token, venueId, here),
  ]);
  const live = templates.filter((t) => !t.retired);
  const activeRules = rules.filter((r) => r.active);

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Checklists</Heading>
      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <Heading level={2}>Your checklists</Heading>
          {live.length === 0 ? (
            <Text type="supporting" color="secondary">
              You have none yet. Copy one from the starters below.
            </Text>
          ) : (
            live.map((t) => (
              <Link key={t.template_key} href={`${here}/${t.template_key}`}>
                {t.name}
                {t.description ? `: ${t.description}` : ""}
              </Link>
            ))
          )}
        </VStack>
      </Card>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Starters you can copy</Heading>
        {library.map((s) => (
          <StarterCard
            key={s.starter_key}
            venueId={venueId}
            starterKey={s.starter_key}
            name={s.name}
            description={s.description ?? null}
            count={s.items.length}
          />
        ))}
      </VStack>
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>When checklists are given out</Heading>
          {activeRules.length === 0 ? (
            <Text type="supporting" color="secondary">
              No rules yet, so nobody is given a checklist.
            </Text>
          ) : (
            activeRules.map((r) => (
              <RuleRow
                key={r.rule_key}
                venueId={venueId}
                ruleKey={r.rule_key}
                text={`${r.template_name ?? "A checklist"} for ${
                  r.target_kind === "everyone"
                    ? "everyone on a shift"
                    : r.target_kind === "position"
                      ? `${r.target_value ?? "a position"} shifts`
                      : (r.target_name ?? "one person")
                }, due ${TIMING_WORDS[r.timing_kind] ?? r.timing_kind}${
                  r.timing_kind === "before_shift_end" && r.offset_minutes
                    ? ` (${r.offset_minutes} minutes before)`
                    : ""
                }${r.timing_kind === "fixed_time" && r.fixed_time ? ` (${r.fixed_time})` : ""}`}
              />
            ))
          )}
        </VStack>
      </Card>
      {live.length > 0 ? (
        <RuleForm
          venueId={venueId}
          templates={live.map((t) => ({
            value: t.template_key,
            label: t.name,
          }))}
          positions={positions
            .filter((p) => p.active)
            .map((p) => ({ value: p.name, label: p.name }))}
          staff={staff.map((s) => ({ value: s.id, label: s.name }))}
        />
      ) : null}
    </VStack>
  );
}
