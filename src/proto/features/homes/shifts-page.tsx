"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { VStack } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import type { Scenario } from "../../types";
import { fmtShiftRange } from "./format";
import { type UpcomingShift, upcomingShifts } from "./staff-shifts";
import { EmptyNote, PageTitle, Sec, StaleBanner } from "./ui";
import { useSections } from "./use-sections";

function shiftsFixture(venueId: string, scenario: Scenario) {
  return { list: upcomingShifts(venueId, scenario) };
}

export function ShiftsPage() {
  const s = useSections("shifts", shiftsFixture, null);
  return (
    <VStack gap={5} hAlign="stretch">
      <PageTitle title="Shifts" sub="Your upcoming shifts" />
      <StaleBanner show={s.scenario === "stale"} />
      <Sec
        title="Upcoming shifts"
        result={s.get<{ periodLabel: string; shifts: UpcomingShift[] }>("list")}
        onRetry={() => s.retry("list")}
      >
        {(d) =>
          d.shifts.length === 0 ? (
            <EmptyNote>You have no upcoming shifts. {d.periodLabel}.</EmptyNote>
          ) : (
            <VStack gap={1} hAlign="stretch">
              <Text type="supporting">{d.periodLabel}</Text>
              <List hasDividers edge="flush">
                {d.shifts.map((sh) => (
                  <ListItem
                    key={sh.id}
                    label={<Text>{fmtShiftRange(sh.start, sh.end)}</Text>}
                    description={<Text type="supporting">{sh.role}</Text>}
                    endContent={
                      sh.overnight ? <Badge label="Overnight" /> : undefined
                    }
                  />
                ))}
              </List>
            </VStack>
          )
        }
      </Sec>
    </VStack>
  );
}
