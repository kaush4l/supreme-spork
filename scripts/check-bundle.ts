// After `bun run build`: nothing the browser downloads may carry the backend's address, the login service's address or
// key, a backend path, or a server-only variable name. Values come from the environment (or `.env.example`).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function exampleEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(".env.example", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) out[match[1] as string] = match[2] as string;
  }
  return out;
}

const fallback = exampleEnv();
const values = ["BACKEND_URL", "AUTH_URL", "AUTH_ANON_KEY"]
  .map((name) => process.env[name] ?? fallback[name])
  .filter((value): value is string => Boolean(value));
const forbidden = [
  ...values,
  "BACKEND_URL",
  "AUTH_URL",
  "AUTH_ANON_KEY",
  "SITE_URL",
  "service_role",
  "/v1/venues",
  "/v1/me",
  "Idempotency-Key",
];

const files = walk(".next/static").filter((path) =>
  /\.(js|css|map|html|json)$/.test(path),
);
const hits: string[] = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const needle of forbidden)
    if (text.includes(needle))
      hits.push(
        `${file}: contains ${needle.length > 40 ? `${needle.slice(0, 12)}...` : needle}`,
      );
}
if (hits.length > 0) {
  console.error(`The browser bundle leaks server details:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(
  `Browser bundle clean: ${files.length} files, ${forbidden.length} patterns.`,
);
