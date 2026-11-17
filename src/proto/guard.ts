import "server-only";

/**
 * The prototype is a deployment-time opt-in. `PROTO_ENABLED=1` is a server-only variable (never NEXT_PUBLIC_), so the
 * flag is not in any browser bundle. When it is not exactly "1", every /proto path answers 404: `proxy.ts` refuses it
 * and `src/app/proto/layout.tsx` calls notFound(). A route group alone is not a guard.
 */
export function protoEnabled(): boolean {
  return process.env.PROTO_ENABLED === "1";
}
