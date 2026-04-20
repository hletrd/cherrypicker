# Comprehensive Code Review -- Cycle 10

**Date:** 2026-04-20
**Reviewer:** Single-agent comprehensive review (cycle 10 of review-plan-fix loop)
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
| C53-01 | **FIXED** | `TransactionReview.svelte:120-139` `changeCategory` now uses replacement pattern (`editedTxs = editedTxs.map(...)`) instead of in-place mutation. Consistent with the `runAICategorization` fix from C52-02. |
| C53-02 | STILL DEFERRED | Duplicated card stats reading logic in `index.astro` and `Layout.astro` |
| C53-03 | STILL DEFERRED | `CardDetail.svelte:226` performance tier header `text-blue-700` dark mode contrast |
| D-106 | STILL DEFERRED | `apps/web/src/lib/parser/pdf.ts:287` bare `catch {}` |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06/C52-03 | STILL DEFERRED | Annual savings projection label unchanged in SavingsComparison |
| C4-09/C52-05 | STILL DEFERRED | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C4-14/C52-04 | STILL DEFERRED | Stale fallback values in Layout footer and index.astro |
| C8-01 | STILL DEFERRED | AI categorizer disabled but 65+ lines of unreachable dead code in TransactionReview comments |
| C8-02/C9R-02 | NOW FIXED | CardDetail.svelte now has AbortController cleanup on unmount (lines 82-95). The `$effect` returns `() => { controller.abort(); }` and the fetch is aborted on component destroy. |
| C8-08 | STILL DEFERRED | inferYear() timezone edge case near midnight Dec 31 |
| C8-09 | STILL DEFERRED | Test duplicates production code |
| C8-10 | STILL DEFERRED | csv.ts installment NaN fragile implicit filter |
| C8-11 | STILL DEFERRED | pdf.ts fallback date regex could match decimals |
| C9R-03 | STILL DEFERRED | pdf.ts negative amounts (refunds) silently dropped |

---

## New Findings

### C10-01: `SpendingSummary.svelte` uses `sessionStorage` for dismissal but the store uses both `sessionStorage` and module-level state (MEDIUM, HIGH)

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte`
**Description:** The previous fix (C4-07/C52-06) moved the warning dismissal flag from `localStorage` to `sessionStorage`. However, the `SpendingSummary` component reads/writes the dismissal flag directly via `sessionStorage.setItem/getItem` on every render cycle, while the `store.svelte.ts` also uses `sessionStorage` for the analysis result. If `sessionStorage` is unavailable (SSR, iframe restrictions, Firefox private browsing with strict settings), the `sessionStorage` calls in `SpendingSummary` will throw, and there is no try/catch around those calls in the component. The store's `persistToStorage` and `loadFromStorage` both have try/catch, but the component does not.
**Failure scenario:** User opens the app in an environment where `sessionStorage` is restricted. The `SpendingSummary` component crashes on mount with an unhandled `SecurityError`, preventing the dashboard from rendering.
**Fix:** Wrap the `sessionStorage` reads/writes in `SpendingSummary` with try/catch, consistent with the pattern used in `store.svelte.ts`.

### C10-02: `CardDetail.svelte` AbortController correctly aborts but error message is generic for aborted requests (LOW, MEDIUM)

**File:** `apps/web/src/components/cards/CardDetail.svelte:87-89`
**Description:** Now that CardDetail properly uses AbortController (fixing C8-02/C9R-02), when the component is destroyed and the fetch is aborted, the catch block at line 88 checks `e.name !== 'AbortError'` before setting the error. This is correct behavior -- aborted requests should not show an error. However, if the network request fails for a real reason (e.g., DNS failure, timeout) and the component is simultaneously being destroyed, the abort will mask the real error. This is a minor concern because the user navigated away anyway.
**Failure scenario:** User clicks a card, network request starts, user quickly navigates back. The abort fires, the real error (if any) is silently swallowed. No visible impact since the user left the page.
**Fix:** No fix needed -- this is correct behavior. Documenting for completeness.

### C10-03: `parseAmount` in csv.ts returns NaN while pdf.ts returns 0 for unparseable amounts -- inconsistency in error handling (LOW, MEDIUM)

**File:** `apps/web/src/lib/parser/csv.ts:114-123` vs `apps/web/src/lib/parser/pdf.ts:207-213`
**Description:** The CSV `parseAmount` returns `NaN` for unparseable amounts, and the caller uses `isValidAmount()` to check and push an error. The PDF `parseAmount` returns `0` for unparseable amounts (via the `Number.isNaN(n) ? 0 : n` guard), which means NaN amounts are silently converted to 0 and then filtered out by the `if (amount === 0) continue` check without any error being reported. This means the PDF parser silently drops unparseable amounts while the CSV parser reports them as errors.
**Failure scenario:** User uploads a PDF with a corrupted amount field. The transaction is silently skipped with no error reported. User doesn't know the transaction was missed.
**Fix:** Add an `errors` parameter to the PDF `parseAmount` function (or have `tryStructuredParse` track skipped rows) and push an error when `parseAmount` returns 0 from a non-zero input, matching the CSV parser's behavior.

---

## Cross-File Consistency Checks

1. **`changeCategory` mutation pattern (C53-01):** Now uses replacement pattern (`editedTxs = editedTxs.map(...)`) consistent with the `runAICategorization` fix. Confirmed fixed.

2. **CardDetail AbortController (C8-02/C9R-02):** Now properly aborts fetch on component destroy via `$effect` cleanup returning `() => { controller.abort(); }`. Confirmed fixed.

3. **All `formatWon` implementations (4 locations):** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

4. **All `formatRate` implementations (5 locations):** All have `Number.isFinite` guard. Consistent.

5. **`parseDateToISO` implementations (3 locations - csv.ts, xlsx.ts, pdf.ts):** All have month/day range validation. Consistent.

6. **`inferYear` implementations (3 locations):** All use the same 90-day look-back heuristic. Consistent.

7. **Web-side CSV error collection (D-107):** Confirmed still working -- `apps/web/src/lib/parser/csv.ts:964-974` collects adapter failures into `fallbackResult.errors.unshift()`. Consistent with server-side.

8. **SessionStorage consistency (C4-07/C52-06):** `SpendingSummary.svelte` uses `sessionStorage` for the dismissal flag. However, the component lacks try/catch around those calls (new finding C10-01 above).

---

## Final Sweep

- No new security issues beyond what is already tracked.
- No new performance issues detected.
- No new type safety issues. All gates pass.
- The `categorizer-ai.ts` file is intentionally disabled (AI categorization disabled until self-hosted runtime is ready).
- The ILP optimizer stub (`packages/core/src/optimizer/ilp.ts`) is still a pass-through to greedy, documented with a TODO.
- No new test coverage gaps beyond C4-10 and C4-11 (already deferred).
- The `CardDetail.svelte` now properly cleans up fetch on unmount via AbortController, resolving the long-standing C8-02/C9R-02/D-62/D-105 finding.

---

## Summary

1 genuinely new actionable finding this cycle (C10-01: `SpendingSummary` lacks try/catch around sessionStorage calls). 1 low-severity inconsistency found (C10-03: PDF parseAmount silently drops unparseable amounts while CSV reports errors). 1 informational note (C10-02: AbortController masks real errors on navigation, which is correct behavior). 2 previously open findings are now confirmed FIXED (C53-01: changeCategory replacement pattern, C8-02: CardDetail AbortController). All gates green. Codebase is stable.
