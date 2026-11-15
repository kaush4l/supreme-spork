import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

const choice = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string(),
});

const ruleValue = z.union([z.string(), z.number(), z.boolean()]);

export const rosterRuleSchema = z.object({
  key: z.string(),
  group: z.string(),
  label: z.string(),
  help: z.string(),
  /** choice | yesno | number | number_or_off */
  kind: z.string(),
  default: ruleValue,
  value: ruleValue,
  changed: z.boolean(),
  choices: z.array(choice).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
  can_be_off: z.boolean().optional(),
});
export type RosterRule = z.infer<typeof rosterRuleSchema>;

export const rosterRulesSchema = z.object({
  groups: z.array(z.object({ key: z.string(), label: z.string() })),
  items: z.array(rosterRuleSchema),
});
export type RosterRules = z.infer<typeof rosterRulesSchema>;

export function rosterRules(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/roster/rules", {
      params: { path: { venue_id: venueId } },
    }),
    rosterRulesSchema,
    next,
  );
}

export const locationSchema = z.object({
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export function clockLocation(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/roster/clock/location", {
      params: { path: { venue_id: venueId } },
    }),
    locationSchema,
    next,
  );
}
