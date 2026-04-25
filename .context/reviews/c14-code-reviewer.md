# Cycle 14 — code-reviewer

**Date:** 2026-04-25
**Scope:** Full repository review focused on code quality, logic, SOLID, maintainability.

## Inventory & Method

Reviewed:
- `packages/core/src/{calculator,optimizer,categorizer}/**`
- `packages/parser/src/**`
- `packages/rules/src/**`, `packages/viz/src/**`
- `apps/web/src/{lib,components,pages}/**`
- `tools/cli/**`, `tools/scraper/**`
- Test suites under `__tests__/`

Cycles 7-13 converged on LOW-only findings. This pass examined the same surface plus the new commits between cycles 12-13 (formatSavingsValue + CategoryBreakdown comments).

## Findings

### C14-CR01 — LOW (Low confidence) — Information
- **File:** `packages/core/src/calculator/reward.ts:65-90` (`findRule`)
- **Observation:** Sort comparator chains by specificity then by `rules.indexOf(a)` for determinism. `rules.indexOf` is O(n), making the sort O(n^2 log n) in the worst case for very large rule lists. For typical card rules (< 30 entries) this is fine. The deterministic-ordering rationale (C1-12) is well documented inline.
- **Why it's a problem:** Not a real problem at current scale; flagged only as an observation for future consideration if a card ever defines hundreds of rules.
- **Failure scenario:** None observable. Theoretical perf cliff far above realistic input sizes.
- **Suggested fix:** No action. Consider precomputing an index map only if a card ever exceeds ~200 rules.
- **Confidence:** Low. **Severity:** LOW (informational).

### C14-CR02 — LOW (Medium confidence) — Maintainability
- **File:** `apps/web/src/lib/category-labels.ts:32-110` (`FALLBACK_CATEGORY_LABELS`)
- **Observation:** Same hardcoded fallback re-flagged by every cycle. Already tracked as deferred (C7-02) with a clear exit criterion (build-time generation from `categories.yaml`). No new instance.
- **Why it's a problem:** Drift risk — re-confirmed but no new manifestation.
- **Failure scenario:** Same as C7-02.
- **Suggested fix:** Same as C7-02 exit criterion.
- **Confidence:** Medium. **Severity:** LOW (carry-forward).

### Final sweep
- Re-checked `findRule` subcategory exclusion logic, calculator wildcard handling, scoreCardsForTransaction loop, parser AbortError paths, web store actions, format helpers. No new issues.
- Tests: `npm run verify` PASS (FULL TURBO), all 96 core tests + 4 CLI + 1 viz + 1 scraper + parser + web tests green.

## Summary

No net-new HIGH or MEDIUM findings. Cycle 14 is another convergence cycle — the codebase remains in a stable, well-documented state where all known issues are either addressed or properly tracked as deferred items.
