import "server-only";
import { type Env, parseEnv } from "./env-schema";

let cached: Env | undefined;

/** The parsed environment, read once. Server only: importing this from a client component fails the build. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
