# Architect — Cycle 12

**Date:** 2026-04-24
**Reviewer:** architect

## Findings

### C12-AR01: CATEGORY_NAMES_KO / FALLBACK_CATEGORY_LABELS / CATEGORY_COLORS / FALLBACK_GROUPS — four hardcoded taxonomy duplicates remain [MEDIUM]
- **File:** `packages/core/src/optimizer/greedy.ts:11-90`, `apps/web/src/lib/category-labels.ts:32-110`, `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87`, `apps/web/src/components/dashboard/TransactionReview.svelte:27-42`
- **Description:** This is the same finding as C7-01, C7-02, C9-01, C8-01. Four separate locations hardcode category metadata that should be generated from `categories.yaml` at build time. The exit criterion remains: build-time code generation from `categories.yaml`. This finding is now carried across 5+ cycles with consistent agent agreement.
- **Confidence:** High
- **Severity:** MEDIUM (drift risk, architectural)

### C12-AR02: Web parser and packages/parser duplicate implementation [MEDIUM]
- **File:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Description:** This is the same finding as D-01. The web parser (browser, no Bun APIs) and packages/parser (Bun runtime) duplicate parsing logic. Full dedup requires the D-01 architectural refactor (shared module between Bun and browser environments).
- **Confidence:** High
- **Severity:** MEDIUM (architectural, already deferred as D-01)

### C12-AR03: `formatIssuerNameKo`, `getIssuerColor`, `getCategoryIconName` duplicate static data [LOW]
- **File:** `apps/web/src/lib/formatters.ts:51-143`
- **Description:** Same finding as C9-03, C9-04, C9-05. Three functions hardcode issuer/category metadata that should be derived from the rules package data. Same exit criterion as C12-AR01 (build-time generation).
- **Confidence:** High
- **Severity:** LOW (same class as C7-01)

## Convergence Note

All three findings are repeats of known deferred architectural items (D-01, C7-01, C9-03/04/05). The architecture is sound for a single-developer project — the hardcoded duplicates are a pragmatic tradeoff that avoids build-time complexity. The exit criterion (build-time generation) remains the correct long-term fix.
