# Cycle 1 Comprehensive Review -- 2026-04-22

Full re-read of all source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper. Verification of prior cycle fixes and search for new issues.

---

## Verification of Prior Cycle Fixes

| Finding | Status | Evidence |
|---|---|---|
| C94-01 | **CONFIRMED FIXED** | `formatSavingsValue()` in `formatters.ts:215-218` centralizes sign-prefix logic; ReportContent, SavingsComparison, and VisibilityToggle all use it |
| C93-01 | **CONFIRMED FIXED** | `{@const}` blocks are direct children of `{#each}` in `ReportContent.svelte` |
| C92-01 | **LARGELY FIXED** | `formatSavingsValue` centralizes the pattern; ReportContent still has a separate `formatSavingsValue(opt.savingsVsSingleCard)` call at line 97 but uses the shared helper |
| C1-01 | **CONFIRMED FIXED** | `analyzer.ts:325-327` only accumulates `tx.amount > 0` for monthlySpending |
| C1-12 | **CONFIRMED FIXED** | `reward.ts:87-93` secondary sort by `rules.indexOf(a) - rules.indexOf(b)` ensures deterministic ordering |
| C1-21 | **CONFIRMED FIXED** | `store.svelte.ts` reoptimize recalculates monthlyBreakdown from editedTransactions before computing previousMonthSpending |
| C1-02 | **CONFIRMED ADDRESSED** | `llm-fallback.ts:34-35` blocks browser execution; API key required from env |
| CF-01 | **STILL OPEN (LOW)** | Parser duplication between packages/parser and apps/web persists (architectural, not actionable without D-01 refactor) |
| CF-13 | **STILL OPEN (LOW)** | CATEGORY_NAMES_KO hardcoded map in greedy.ts still present with TODO comment |
| C1-03/C90-02 | **STILL OPEN (LOW)** | KakaoBank issuer badge #fee500 (yellow) on white text fails WCAG AA |

---

## Gate Status

| Gate | Status |
|---|---|
| `npm run lint` | PASS -- all 5 packages pass tsc --noEmit |
| `npm run typecheck` | PASS -- all 5 packages typecheck clean |
| `npm run test` | PASS -- 195 tests across all packages |
| `npm run build` | PASS -- 7 packages built (Vite chunk size warning on web, non-blocking) |

---

## New Findings (This Cycle)

After thorough re-reading of all source files, **no new HIGH or MEDIUM severity issues were found**. The codebase is in a stable, well-maintained state after 94+ cycles of fixes. The code is well-documented with inline comments referencing prior fix IDs, and all critical issues have been addressed.

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C1-N01 | LOW | HIGH | `formatters.ts:51-79` | `formatIssuerNameKo` hardcoded 24-entry map drifts from issuer IDs in YAML data, same pattern as CATEGORY_NAMES_KO drift. A new issuer added to YAML without updating this function falls back to the raw issuer ID. Not a bug (graceful fallback) but the same maintenance hazard. |
| C1-N02 | LOW | MEDIUM | `CategoryBreakdown.svelte:6-84` | `CATEGORY_COLORS` hardcoded 84-entry map (including dot-notation keys) drifts from the YAML taxonomy, same pattern as CATEGORY_NAMES_KO. New categories would fall back to gray, which is visually acceptable but inconsistent. |
| C1-N03 | LOW | MEDIUM | `SavingsComparison.svelte:76-88` | RAF animation uses `performance.now()` for timing but doesn't cancel the RAF when the `$effect` cleanup runs before the first `tick()` callback fires (race on very fast re-renders). The cleanup function calls `cancelAnimationFrame(rafId)`, but `rafId` is only assigned after `requestAnimationFrame` returns. If the effect re-runs synchronously before the RAF callback, `cancelAnimationFrame(undefined)` is called, which is a no-op but not harmful. |
| C1-N04 | LOW | HIGH | `apps/web/src/lib/parser/csv.ts` | `splitLine`, `parseAmount`, `isValidAmount`, `parseInstallments` are duplicated from `packages/parser/src/csv/shared.ts` with a NOTE comment acknowledging the duplication (D-01 refactor). Same known architectural issue as CF-01. |

---

## Still-Open Items from Prior Cycles (LOW severity, deferred)

| Finding | Severity | Note |
|---|---|---|
| C1-03/C90-02 | LOW | KakaoBank #fee500 on white text WCAG AA failure |
| C89-01 | LOW | VisibilityToggle classList.toggle without isConnected guard |
| C89-02 | LOW | CategoryBreakdown rawPct < 2 threshold uses unrounded value |
| C89-03 | LOW | formatters.ts m! non-null assertion after length check |
| CF-01 | LOW | Full parser duplication server/web |
| CF-13 | LOW | CATEGORY_NAMES_KO hardcoded map drift |
| CF-19 | LOW | ILP optimizer is silent stub |

---

## Summary

The codebase is in a healthy, stable state after 94+ cycles. All gates pass cleanly. No new HIGH or MEDIUM findings this cycle. The remaining open items are all LOW severity and have been stable across many cycles. The only actionable item this cycle is the KakaoBank WCAG contrast issue (C1-03), which requires a color change from #fee500 to a darker shade or changing the badge text color to dark.
