import { z } from "zod";

/**
 * The environment this server needs. Nothing here is `NEXT_PUBLIC_`: no value reaches the browser.
 * A missing or invalid value stops the server with the names of the variables, never their values.
 */
const schema = z.object({
  /** The Minder backend (private network address in production). */
  BACKEND_URL: z.url(),
  /** The login service (GoTrue), ending in `/auth/v1`. */
  AUTH_URL: z
    .url()
    .refine(
      (value) => value.replace(/\/+$/, "").endsWith("/auth/v1"),
      "must end with /auth/v1",
    ),
  /** The public anon key the login service expects in the `apikey` header. */
  AUTH_ANON_KEY: z.string().min(20),
  /** The public address of this app. */
  SITE_URL: z.url(),
});

export type Env = z.infer<typeof schema>;

/** The login service's base address: `AUTH_URL` without `/auth/v1` (the Supabase client adds the path itself). */
export function authBaseUrl(authUrl: string): string {
  return authUrl.replace(/\/+$/, "").replace(/\/auth\/v1$/, "");
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(
      `Missing or invalid environment variables: ${names.join(", ")}`,
    );
  }
  if (
    source.NODE_ENV === "production" &&
    !result.data.SITE_URL.startsWith("https://")
  ) {
    throw new Error(
      "Missing or invalid environment variables: SITE_URL (must be https in production)",
    );
  }
  return result.data;
}
