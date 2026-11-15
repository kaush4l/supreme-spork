import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** Targets are only sent to owner, partner, manager and bookkeeper, so they may be missing. Percentages are plain numbers (60 = 60%). */
export const venueSettingsSchema = z.object({
  venue_id: z.string(),
  name: z.string(),
  timezone: z.string(),
  trading_day_start: z.string(),
  prime_cost_target_pct: z.number().optional(),
  labour_target_pct: z.number().optional(),
  target_margin_pct: z.number().optional(),
  roster_hours_alert: z.number().optional(),
});
export type VenueSettings = z.infer<typeof venueSettingsSchema>;

export function venueSettings(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/settings", {
      params: { path: { venue_id: venueId } },
    }),
    venueSettingsSchema,
    next,
  );
}

export const hoursSchema = z.object({
  days: z.array(
    z.object({
      dow: z.number(),
      day: z.string(),
      set: z.boolean(),
      closed: z.boolean().nullable(),
      opens: z.string().nullable(),
      closes: z.string().nullable(),
    }),
  ),
});
export type OpeningHours = z.infer<typeof hoursSchema>;

export function openingHours(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/hours", {
      params: { path: { venue_id: venueId } },
    }),
    hoursSchema,
    next,
  );
}

export const holidaysSchema = z.object({
  year: z.number(),
  holidays: z.array(z.object({ date: z.string(), name: z.string() })),
});
export type Holidays = z.infer<typeof holidaysSchema>;

export function publicHolidays(
  token: string,
  venueId: string,
  year: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/holidays", {
      params: { path: { venue_id: venueId }, query: { year } },
    }),
    holidaysSchema,
    next,
  );
}
