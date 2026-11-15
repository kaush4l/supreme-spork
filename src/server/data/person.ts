import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** The person's own pages. Nothing here holds pay or manager notes: the API never sends them. */

export const profileSchema = z.object({
  user_id: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  phone: z.string().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  skills: z.array(z.string()),
});
export type PersonProfile = z.infer<typeof profileSchema>;

export const certificateSchema = z.object({
  id: z.string(),
  kind: z.string(),
  number: z.string().nullable(),
  expires_on: z.string(),
  source: z.string(),
});
export type PersonCertificate = z.infer<typeof certificateSchema>;

export const employmentSchema = z.object({
  venue_id: z.string(),
  venue_name: z.string().nullable(),
  staff_id: z.string(),
  position_names: z.array(z.string()),
  started_on: z.string().nullable(),
  ended_on: z.string().nullable(),
  active: z.boolean(),
});
export type PersonEmployment = z.infer<typeof employmentSchema>;

export const availabilitySchema = z.object({
  id: z.string(),
  kind: z.string(),
  weekday: z.number().nullable(),
  from_time: z.string().nullable(),
  to_time: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  available: z.boolean(),
  note: z.string().nullable(),
});
export type PersonAvailability = z.infer<typeof availabilitySchema>;

export const calendarSchema = z.object({
  has_link: z.boolean(),
  since: z.string().nullable(),
});

export function myProfile(token: string) {
  return read(
    backend(token).GET("/v1/me/profile"),
    profileSchema,
    "/account/profile",
  );
}

export function myCertificates(token: string) {
  return read(
    backend(token).GET("/v1/me/certificates"),
    z.array(certificateSchema),
    "/account/certificates",
  );
}

export function myEmployments(token: string) {
  return read(
    backend(token).GET("/v1/me/employments"),
    z.array(employmentSchema),
    "/account/work",
  );
}

export function myAvailability(token: string) {
  return read(
    backend(token).GET("/v1/me/availability"),
    z.array(availabilitySchema),
    "/account/availability",
  );
}

export function myCalendar(token: string) {
  return read(
    backend(token).GET("/v1/me/calendar"),
    calendarSchema,
    "/account/calendar",
  );
}
