# Supreme Spork

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
bun install     # install dependencies
bun run dev     # start the dev server at http://localhost:3000
bun run build   # production build
bunx biome check  # lint and format check
```

Astryx component docs live in `AGENTS.md` (written by
`bun x @astryxdesign/cli init`). Look up a component with
`bun x @astryxdesign/cli component <Name>`.
