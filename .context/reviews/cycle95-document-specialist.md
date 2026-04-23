# Cycle 95 — document-specialist

## Doc/Code Consistency Check

- `CLAUDE.md` (project): tech stack matches — Astro 6, Svelte 5, Bun, Tailwind 4, LayerChart, Zod. Monorepo structure matches.
- `README.md` (if present) — deferred D-02 (license mismatch) already recorded.
- Code comments referencing finding IDs (C1-01, C44-01, etc.) trace to plan docs correctly.
- `CATEGORY_NAMES_KO` + `CATEGORY_COLORS` hardcoded maps — deferred D-42, D-64, D-78, D-96 still track drift risk vs. YAML taxonomy.
- `BANK_SIGNATURES` duplication (`packages/parser/src/detect.ts` vs `apps/web/src/lib/parser/detect.ts`) — deferred D-57 still tracked.

## Authoritative Source Checks

- Latest Svelte 5 patterns used: `$state`, `$derived.by`, `$effect`, `onMount`, keyed `#each`.
- Latest Astro 6 patterns: `import.meta.env.BASE_URL`, `is:inline`.
- Tailwind 4 utility-first: CSS variables via `var(--color-*)`.

## New Findings

None.

## Summary

0 new findings. Docs/code alignment holds.
