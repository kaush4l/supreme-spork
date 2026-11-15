# Supreme Spork

This repository is the web UI for the Minder Pass backend (`../minder-pass`, a FastAPI `/v1` API). It talks to the backend over HTTP only.

Rules that always hold. Where the UI stands (state, next steps, change log) is in `../minder-pass-documents/ui/UI_PROGRESS.md`, not here.

## Project documents (read before working, update before finishing)
All project documents live in `../minder-pass-documents/` (sibling of this repo), never inside this repo. Start every session by reading its `README.md`, `ui/UI_PROGRESS.md` and `handoff/README.md` (the API contract and conventions). If that folder is not accessible, say so before doing anything else.

- After every UI change, add a row to the change log in `ui/UI_PROGRESS.md` and update its "Current state" and "Next".
- Record non-obvious choices in `../minder-pass-documents/decisions/decisions.md`.
- Do not commit or push unless the owner asks. Do not install system software without asking.

## UI rules
- The UI never computes a number: every figure, total and percentage comes from the API. Money is integer cents.
- Show statuses with the `label` and `help` the API sends. Errors use `{error: {code, message, field}}`; some older routes send `{detail}`.
- A screen needs an existing backend endpoint. A missing route goes under "Gaps" in `ui/UI_PROGRESS.md` and in the open questions; do not work around it.
- Stack: Next.js 16, React 19, Bun, Biome, Astryx. No Tailwind, no raw `<div>`. `AGENTS.md` has the Next.js and Astryx rules; read it first.
- Server-only code is in `src/server/`. The browser never calls the backend or the login service; pages, Server Actions (`action`) and Route Handlers (`handler`) do, with the session read from an HttpOnly cookie. Every page, action and handler calls `requirePrincipal`; `proxy.ts` is not an access check. Every write is a Server Action with a `strictInput` schema, or a Route Handler for uploads.
- Run only the tests a change affects (`bun test <path>`, `bunx playwright test -g <name>`); do not run everything.

## Model routing
For multi-step tasks follow `../minder-pass/.claude/skills/model-routing/SKILL.md`: Haiku for reading, searching, git and mechanical edits; Sonnet for summaries and well-specified code; the main model for design and review.

@AGENTS.md
