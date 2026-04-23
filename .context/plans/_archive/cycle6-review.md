# Cycle 6 Plan -- 2026-04-22

## Review Summary

Full re-read of all source files across the entire repository (packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper). All prior actionable fixes have been verified as correctly applied. **No new HIGH or MEDIUM severity findings this cycle.**

The codebase is in a stable, healthy state. The last actionable finding (C92-01/C94-01 -- savings sign-prefix logic triplication) was fixed in a prior cycle via the `formatSavingsValue()` helper in `formatters.ts`, and this fix is confirmed working.

---

## New Findings Addressed This Cycle

None. No new findings of any severity were produced this cycle.

---

## Implementation Tasks This Cycle

No implementation tasks required -- there are no new findings to address.

---

## Deferred Findings (unchanged from prior cycles)

All deferred items remain unchanged with the same severity and exit criteria as prior cycles:

| Finding | Severity | Exit Criterion |
|---|---|---|
| MerchantMatcher O(n) scan (C33-01) | MEDIUM | Performance bottleneck becomes measurable in profiling; user-reported latency |
| cachedCategoryLabels staleness (C21-02) | MEDIUM | User reports stale labels after redeployment |
| Greedy optimizer O(m*n*k) (C67-01) | MEDIUM | User-reported timeout with large card sets |
| No integration test for multi-file upload (C86-16) | MEDIUM | Manual QA failure or regression in multi-file path |
| loadCategories empty on AbortError (C41-05) | MEDIUM | User reports empty dropdowns after navigation |
| BANK_SIGNATURES duplication (C7-07) | LOW | New bank added and only one location updated |
| CATEGORY_NAMES_KO drift (C64-03) | LOW | YAML taxonomy update breaks CLI display |
| VisibilityToggle DOM mutation (C18-01) | LOW | Svelte 5 deprecates direct DOM manipulation in effects |
| Annual savings *12 projection (C77-02) | LOW | User reports misleading projection (transparently labeled) |
| Mobile menu focus trap (C86-13) | LOW | Accessibility audit finding |
| KakaoBank badge contrast (C90-02) | LOW | Accessibility audit finding |
| All other LOW items from prior cycles | LOW | Per-item exit criteria in aggregate |

---

## Archived Plans (Fully Implemented)

All prior cycle plans through C94 have been fully implemented. The codebase is stable with no regressions.
