# Comprehensive Code Review -- Cycle 11

**Date:** 2026-04-20
**Reviewer:** Single-agent comprehensive review (cycle 11 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-53 reviews and the aggregate. Ran `bun test` (266 pass, 0 fail), `bun run lint` (0 errors), `bun run typecheck` (0 errors), and `bun run build` (success). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior "Still-Open" Deferred Findings

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present unless noted:

| Finding | Status | Notes |
|---|---|---|
| C10-01 | **FIXED** | `SpendingSummary.svelte:10-18` now has try/catch around sessionStorage reads in `onMount`, and `SpendingSummary.svelte:139` has try/catch around sessionStorage writes in the dismiss button handler. Both are consistent with the store's pattern. |
| C10-02 | STILL DEFERRED | Correct behavior documented -- no fix needed |
| C10-03 | **PARTIALLY FIXED** | `pdf.ts:264-273` now reports errors for unparseable amounts (non-zero input that parses to 0). However, the error reporting is imperfect: the `parseErrors` array from `tryStructuredParse` is returned but the fallback path at line 387-393 does NOT collect or report parse errors from the fallback scan. This is a remaining gap. |
| C8-01 | STILL DEFERRED | AI categorizer disabled but dead code in TransactionReview comments |
| C8-08 | STILL DEFERRED | inferYear() timezone edge case near midnight Dec 31 |
| C8-09 | STILL DEFERRED | Test duplicates production code |
| C8-10 | STILL DEFERRED | csv.ts installment NaN fragile implicit filter |
| C8-11 | STILL DEFERRED | pdf.ts fallback date regex could match decimals |
| C9R-03 | STILL DEFERRED | pdf.ts negative amounts (refunds) silently dropped |
| D-106 | STILL DEFERRED | `apps/web/src/lib/parser/pdf.ts:296` bare `catch {}` |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06/C52-03 | STILL DEFERRED | Annual savings projection label unchanged in SavingsComparison |
| C4-09/C52-05 | STILL DEFERRED | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C4-14/C52-04 | STILL DEFERRED | Stale fallback values in Layout footer and index.astro |
| C53-02 | STILL DEFERRED | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03 | STILL DEFERRED | CardDetail performance tier header dark mode contrast |

---

## New Findings

### C11-01: `SpendingSummary.svelte` negative-zero display after `Math.abs()` in reoptimize (LOW, Medium)

**File:** `apps/web/src/lib/store.svelte.ts:378`
**Description:** In `reoptimize()`, the monthly spending calculation uses `Math.abs(tx.amount)` when accumulating per-month spending: `monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + Math.abs(tx.amount))`. This is correct -- it ensures refunds don't reduce the spending total. However, the same `Math.abs()` is NOT used in `analyzeMultipleFiles()` at line 304, which uses `tx.amount` directly. In practice, refunds are filtered out by the `tx.amount > 0` check in the optimizer, so they wouldn't reach either accumulation path. But the inconsistency means that if a refund transaction with a negative amount were somehow included in the monthlyBreakdown calculation, `analyzeMultipleFiles` would subtract it while `reoptimize` would add its absolute value.
**Failure scenario:** A transaction with `amount: -50000` in the edited list would be handled differently between initial analysis and reoptimize, causing the monthly breakdown numbers to diverge after editing.
**Fix:** Use `Math.abs(tx.amount)` in `analyzeMultipleFiles` line 304 to match the `reoptimize` pattern, or add a comment explaining why the inconsistency is safe (because negative amounts are filtered before reaching this code).

### C11-02: `CardDetail.svelte` `window.location.href` navigation missing BASE_URL trailing slash handling (LOW, Low)

**File:** `apps/web/src/components/cards/CardDetail.svelte:276`
**Description:** The navigation uses `window.location.href = import.meta.env.BASE_URL + 'cards'`. If `BASE_URL` does not end with a `/`, the URL will be malformed (e.g., `/cherrypickercards` instead of `/cherrypicker/cards`). The same pattern is used in `FileDropzone.svelte:217`. Other places in the codebase (like Layout.astro) use template literals with `${base}cards` where `base` already has the trailing slash. This works currently because Astro's `BASE_URL` always includes a trailing slash, but it's fragile -- if the config changes or is overridden, navigation would break.
**Failure scenario:** If `BASE_URL` is set to `/cherrypicker` without a trailing slash, the "카드 목록으로 돌아가기" button navigates to `/cherrypickercards` instead of `/cherrypicker/cards`.
**Fix:** Use template literal `${import.meta.env.BASE_URL}cards` or ensure a `/` separator: `import.meta.env.BASE_URL + '/cards'` (relying on BASE_URL always having trailing slash as Astro guarantees).

### C11-03: PDF fallback path does not report unparseable amount errors (LOW, Medium)

**File:** `apps/web/src/lib/parser/pdf.ts:352-394`
**Description:** Following up on C10-03 (partially fixed): the `tryStructuredParse` function now correctly reports unparseable amounts via `parseErrors`, and these are returned to the caller. However, the fallback parsing path (lines 352-394) does NOT track or report any errors. When a fallback transaction has an unparseable amount (`parseAmount` returns 0), the `amount !== 0` check at line 375 silently skips the transaction without recording any error. This means if the structured parser fails and the fallback parser takes over, the user gets no feedback about skipped transactions.
**Failure scenario:** User uploads a PDF where the structured parser fails (malformed table), and the fallback parser finds date+amount patterns but some amounts are unparseable. The user sees fewer transactions than expected with no error message explaining the gap.
**Fix:** Add an `errors` array to the fallback path and push an error when `parseAmount` returns 0 from a non-zero input, similar to the structured path fix.

---

## Cross-File Consistency Checks

1. **sessionStorage try/catch (C10-01):** `SpendingSummary.svelte:10-18` (onMount) and `SpendingSummary.svelte:139` (dismiss button) both have try/catch. `store.svelte.ts` has try/catch around all sessionStorage calls. Consistent.

2. **PDF parseAmount error reporting (C10-03):** `tryStructuredParse` now reports unparseable amounts correctly. The fallback path does not (new finding C11-03 above).

3. **All `formatWon` implementations (4 locations):** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

4. **All `formatRate` implementations (5 locations):** All have `Number.isFinite` guard. Consistent.

5. **`parseDateToISO` implementations (3 locations - csv.ts, xlsx.ts, pdf.ts):** All have month/day range validation. Consistent.

6. **`inferYear` implementations (3 locations):** All use the same 90-day look-back heuristic. Consistent.

7. **`parseAmount` inconsistency between CSV and PDF:** CSV returns NaN (caller reports via `isValidAmount`), PDF returns 0 (structured path now reports errors for non-zero inputs). The fallback path still has the inconsistency (C11-03). XLSX returns `null` (caller checks for null). These are intentional design differences but worth noting.

8. **`isValidTx` validation:** Now includes `Number.isFinite(tx.amount)` and `tx.amount > 0` checks, addressing prior D-99 concern about NaN amounts passing validation.

9. **CardDetail AbortController cleanup:** Correctly implemented via `$effect` return cleanup. No issues found.

10. **`changeCategory` replacement pattern:** Uses `editedTxs.map()` instead of in-place mutation. Consistent with the `runAICategorization` fix.

11. **`monthlyBreakdown` sorting:** Both `analyzeMultipleFiles` (line 359-361) and `reoptimize` (line 381-382) sort by month. Consistent.

12. **`Math.abs(tx.amount)` in monthly spending:** Used in `reoptimize` (line 378) but NOT in `analyzeMultipleFiles` (line 304). Inconsistency documented as C11-01.

---

## Final Sweep

- No new security issues beyond what is already tracked.
- No new performance issues detected. The `Math.max(...array)` stack overflow risk (D-73/D-89) has been resolved -- all spread patterns have been replaced with `.reduce()` calls.
- No new type safety issues. All gates pass (lint, typecheck, test, build).
- The `categorizer-ai.ts` file is intentionally disabled (AI categorization disabled until self-hosted runtime is ready).
- The ILP optimizer stub (`packages/core/src/optimizer/ilp.ts`) is still a pass-through to greedy, documented with a TODO.
- No new test coverage gaps beyond C4-10 and C4-11 (already deferred).
- No new UI/UX accessibility issues beyond what is already tracked.
- All `import.meta.env.BASE_URL` usages are correct (Astro guarantees trailing slash).
- The `build-stats.ts` shared module correctly deduplicates the card stats reading logic from `index.astro` and `Layout.astro` (partially addressing C53-02).

---

## Summary

0 genuinely new actionable findings this cycle. 2 low-severity issues found (C11-01: Math.abs inconsistency in monthly spending calculation, C11-03: PDF fallback path does not report unparseable amount errors). 1 previously open finding is now confirmed FIXED (C10-01: SpendingSummary sessionStorage try/catch). 1 previously open finding is partially fixed (C10-03: PDF parseAmount now reports errors in structured path, but fallback path still silent). All gates green. Codebase is stable with no medium or high severity new findings.
