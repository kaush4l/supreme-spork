# Supreme Spork

The web UI for the Minder Pass backend (`../minder-pass`). Project documents, UI progress and the API contract live in `../minder-pass-documents/` (`ui/UI_PROGRESS.md`, `handoff/README.md`); read them before working. See `CLAUDE.md`.

Next.js (App Router) + Bun + Biome + TypeScript, styled with Astryx
(Meta's React 19 design system, neutral theme). No Tailwind.

## Stack

- Next.js 16, React 19
- Bun 1.4 for package management and running scripts
- Biome for linting and formatting
- TypeScript
- Astryx (`@astryxdesign/core`, `@astryxdesign/theme-neutral`) for the
  component library and styling

## Commands

```bash
bun install            # install dependencies (Bun 1.4.4)
cp .env.example .env.local   # server-only settings: backend address, login service, anon key, site address
bun run dev            # start the dev server at http://localhost:3000
bun run build          # production build
bun run check          # biome (lint and format check)
bun run typecheck      # tsc --noEmit
bun test src           # unit tests (bun test)
bun run check:bundle   # after a build: nothing the browser downloads may carry server details
bun run e2e            # browser tests against the production build (PW_CHANNEL=chrome uses the installed Chrome)
BACKEND_REPO=../minder-pass bun run api:sync && bun run api:gen   # refresh the generated backend client types
bun audit              # dependency advisories
```

How the app is built (security plan, `../minder-pass-documents/plans/auth-rbac-security-plan.md`):
- Server-only code lives in `src/server/`. The browser never calls the backend or the login service: Server Components,
  Server Actions (`src/server/action.ts`) and Route Handlers (`src/server/handler.ts`) do, with the person's token read
  from an HttpOnly session cookie. No setting is `NEXT_PUBLIC_`.
- Every page, action and handler checks the session itself (`requirePrincipal` in `src/server/auth/principal.ts`);
  `src/proxy.ts` only sets the Content-Security-Policy and refreshes the session.
- The backend client (`src/server/api/`) is generated from the backend's own `api/openapi.json`.

Astryx component docs live in `AGENTS.md` (written by
`bun x @astryxdesign/cli init`). Look up a component with
`bun x @astryxdesign/cli component <Name>`.
