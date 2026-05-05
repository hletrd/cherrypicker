# Cycle 16 — Architecture Review

**Date:** 2026-05-06
**Scope:** Design risks, coupling, layering, monorepo health

## Findings

### C16-ARCH01 [MEDIUM] — Persistent parser duplication between web and server packages
- **Files:** `apps/web/src/lib/parser/` vs `packages/parser/src/`
- **Issue:** The codebase maintains near-identical parsers in both locations. Recent cycles have added forward-fill parity (C100-01), negative amount handling (C100-02), and shared normalizeHTML, but the structural duplication remains. Every parser enhancement requires changes in two places, creating drift risk.
- **Impact:** Maintenance burden, parity bugs (e.g., C99 finding where web-side JSON parser rejected negative amounts while server-side accepted them). The cycle100 fix addressed specific symptoms but not the root cause.
- **Fix:** Extract shared parser logic into a pure-TS package that both web and server can import. The `packages/parser/` package already exists — the web app could import from it directly instead of maintaining shadow copies. Astro/Svelte bundling supports this.
- **Confidence:** High

### C16-ARCH02 [LOW] — `build-stats.ts` hardcodes stale fallback values
- **File:** `apps/web/src/lib/build-stats.ts:16-18`
- **Issue:** The fallback values (683 cards, 24 issuers, 45 categories) are hardcoded. If `cards.json` fails to build, stale values are displayed silently.
- **Impact:** Cosmetic — landing page shows incorrect stats if build fails.
- **Fix:** Add a build-time check that verifies the fallback values match the actual cards.json, or generate this file from cards.json at build time.
- **Confidence:** Medium

### C16-ARCH03 [LOW] — `loadFromStorage` uses `as AnalysisResult` cast after partial validation
- **File:** `apps/web/src/lib/store.svelte.ts:312`
- **Issue:** After shallow validation of only a few fields, the function casts the result `as AnalysisResult`. This bypasses TypeScript's structural checking for all other fields.
- **Impact:** If persisted data has unexpected shapes for unvalidated fields, runtime errors occur in dependent components.
- **Fix:** Replace the cast with explicit field-by-field construction or a runtime schema validator (Zod).
- **Confidence:** Medium

## Summary
One MEDIUM architectural finding (parser duplication) and two LOW findings. The duplication issue has been carried forward across many cycles and should be prioritized.
