# Cycle 17 — Architecture Review

**Date:** 2026-05-05
**Scope:** Design risks, coupling, layering, parity maintenance

## Findings

### C17-ARCH01 [MEDIUM] — Server/web PDF fallback amount regex divergence
- **File:** `packages/parser/src/pdf/index.ts:318` vs `apps/web/src/lib/parser/pdf.ts:573`
- **Issue:** The server-side and web-side PDF fallback scanners have diverged in their amount regex capture groups. The server-side has `([\d,]*(?:,|\d{5,})[\d,]*)-` (minus outside group) while the web-side has `([\d,]*(?:,|\d{5,})[\d,]*-)` (minus inside group). This is a parity violation that causes different behavior for the same input.
- **Root cause:** The two parsers are maintained as separate copies (different build systems: Bun vs Astro/Svelte). There is no automated parity check that would flag this divergence at build time or in CI.
- **Impact:** Users get different results depending on whether they use the CLI (server) or web app.
- **Recommendation:** Consider extracting shared parser patterns into a publishable package, or add a parity test that asserts the server and web regex patterns produce identical capture groups.
- **Confidence:** High

### C17-ARCH02 [LOW] — `normalizeHTML` duplicated between `csv/shared.ts` and `html.ts`
- **File:** `packages/parser/src/csv/shared.ts:180`, `packages/parser/src/html/index.ts`, `apps/web/src/lib/parser/html.ts:27`
- **Issue:** The `normalizeHTML` function exists in three places. The server-side HTML parser likely also has its own copy (or imports from csv/shared). The web-side HTML parser has its own copy.
- **Impact:** Low — drift risk if one copy is fixed and others are not.
- **Recommendation:** Ensure all HTML parsers import from a single shared location. Verify the server-side HTML parser imports `normalizeHTML` from `csv/shared.ts` rather than duplicating it.
- **Confidence:** Medium

### C17-ARCH03 [LOW] — `MIGRATIONS` type safety debt
- **File:** `apps/web/src/lib/store.svelte.ts:115`
- **Issue:** The migration system is designed for future schema evolution but currently uses `any` types. When migrations are actually needed, the unsafe typing will make it easy to introduce bugs.
- **Recommendation:** Define a proper `Migration` type using `unknown` and branded types, and add a helper that validates the migrated shape before returning.
- **Confidence:** Medium

## Summary

| Severity | Count |
|----------|-------|
| MEDIUM | 1 |
| LOW | 2 |

The main architectural risk is the server/web parity gap. After 17 cycles of manual synchronization, small divergences are accumulating.
