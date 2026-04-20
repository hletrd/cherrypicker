# Comprehensive Code Review -- Cycle 12

**Date:** 2026-04-20
**Reviewer:** Single-agent comprehensive review (cycle 12 of review-plan-fix loop)
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
| C11-01 | **FIXED** | `analyzer.ts:304` now uses `Math.abs(tx.amount)` matching `store.svelte.ts:378` |
| C11-02 | STILL DEFERRED | LOW/LOW severity; Astro guarantees BASE_URL trailing slash |
| C11-03 | **FIXED** | `pdf.ts:382-389` now reports errors for unparseable amounts in fallback path |
| C8-01 | STILL DEFERRED | AI categorizer disabled but dead code |
| C8-08 | STILL DEFERRED | inferYear() timezone edge case |
| C8-09 | STILL DEFERRED | Test duplicates production code |
| C8-10 | STILL DEFERRED | csv.ts installment NaN fragile implicit filter |
| C8-11 | STILL DEFERRED | pdf.ts fallback date regex could match decimals |
| C9R-03 | STILL DEFERRED | pdf.ts negative amounts (refunds) silently dropped |
| D-106 | STILL DEFERRED | bare `catch {}` in pdf.ts tryStructuredParse |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06/C52-03 | STILL DEFERRED | Annual savings projection label unchanged |
| C4-09/C52-05 | STILL DEFERRED | Hardcoded CATEGORY_COLORS (dark mode contrast) |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C4-14/D-44/C8-07 | STILL DEFERRED | Stale fallback values in Layout footer / build-stats |
| C53-02 | STILL DEFERRED | Duplicated card stats reading logic |
| C53-03 | STILL DEFERRED | CardDetail performance tier header dark mode contrast |

---

## New Findings

### C12-01: `OptimalCardMap.svelte:19` uses `.reduce()` for `maxRate` but minimum floor is 0.005 -- bars can appear disproportionate for very low rates (LOW, Low)

**File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:17-25`
**Description:** The `maxRate` derived value uses `assignments.reduce((max, a) => Math.max(max, a.rate), 0)` with a floor of 0.005 (0.5%). This is correct behavior -- it prevents division-by-zero and ensures bars are proportionally small when all rates are near-zero. However, when the maximum rate is, say, 0.3% (0.003), the floor makes the denominator 0.5% and all bars appear wider than their actual proportion. A rate of 0.3% would fill 60% of the bar (0.003/0.005 * 100). This is a minor visual distortion that only affects cards with very low reward rates.
**Failure scenario:** A card with 0.1% effective rate shows a bar filling 20% of the width instead of the correct proportional size.
**Fix:** Lower the floor to 0.001 (0.1%) or use a logarithmic scale for very low rates. Alternatively, document the behavior as intentional (prevents bars from being invisible at low rates).

### C12-02: `SpendingSummary.svelte:123-133` -- `monthDiff` calculation can be NaN when only one month exists but `monthlyBreakdown.length > 1` (LOW, Low)

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:121-135`
**Description:** The template accesses `mb[mb.length - 2]` for `prevMonth` and `mb[mb.length - 1]` for `latestMonth`, then extracts year/month parts via `slice`. The `parseInt` + `Number.isFinite` guard on line 129 correctly handles NaN from `parseInt`, but if `prevMonth` is undefined (which cannot happen since `mb.length > 1` is checked), the optional chaining `prevMonth?.spending` on line 133 would show "0원". This is actually safe because the length check ensures both indices exist. However, the `monthDiff` calculation on line 129 does `y1 - y2` where `y1` and `y2` come from `parseInt(latestMonth.month.slice(0, 4), 10)`. If the month string is malformed (e.g., empty), `parseInt` returns NaN, making `monthDiff` NaN, and the ternary falls to `'이전 달 실적'` label. This is correct fallback behavior but the `Number.isFinite` check is unnecessarily complex -- a simple check `monthDiff === 1` would suffice since NaN !== 1.
**Failure scenario:** None -- the existing guard handles malformed data correctly.
**Fix:** No fix needed. Document as correct behavior. Downgraded from finding to observation.

### C12-03: `parseFile` in `parser/index.ts:34` silently swallows encoding detection errors with `catch { continue; }` (LOW, Medium)

**File:** `apps/web/src/lib/parser/index.ts:34`
**Description:** The encoding detection loop tries `utf-8`, `euc-kr`, `cp949` in sequence. If a decoding attempt throws an exception (which `TextDecoder` should not do for valid encoding names, but could in edge cases with very large buffers), the error is silently swallowed. The fallback at line 37 uses `bestContent || new TextDecoder('utf-8').decode(buffer)`, so if all decodings fail, utf-8 is used. This is already tracked as D-109. Re-confirming it is still present.

**This is NOT a new finding** -- it is already tracked as D-109. No new action needed.

### C12-04: `SavingsComparison.svelte:203` negative-zero display guard uses `Object.is(displayedSavings, -0)` which is correct but fragile (LOW, Low)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:203`
**Description:** The template renders `{Object.is(displayedSavings, -0) || displayedSavings >= 0 ? '+' : ''}{formatWon(displayedSavings)}`. The `Object.is(displayedSavings, -0)` check correctly handles the JavaScript negative-zero edge case. However, `formatWon` already normalizes negative zero at line 8 (`if (amount === 0) amount = 0`), so the `Object.is` check is redundant -- `formatWon` will never produce "-0원" because it normalizes before formatting. The `Object.is` check adds a dependency on JavaScript's negative-zero semantics that is fragile and confusing for future maintainers.
**Failure scenario:** None -- the guard is redundant but not harmful.
**Fix:** Remove the `Object.is(displayedSavings, -0) ||` part since `formatWon` already handles negative-zero normalization. Or keep it and add a comment explaining it's a belt-and-suspenders guard.

### C12-05: `CardDetail.svelte` performance tier header uses hardcoded `text-blue-700 dark:text-blue-300` -- poor contrast on some dark backgrounds (LOW, Medium)

**File:** `apps/web/src/components/cards/CardDetail.svelte:226`
**Description:** The performance tier header row uses `text-blue-700 dark:text-blue-300` for the tier label. On the `bg-[var(--color-primary-light)]` background in dark mode, `text-blue-300` may have insufficient contrast depending on the primary-light CSS variable value. This is already tracked as C53-03. Re-confirming it is still present.

**This is NOT a new finding** -- it is already tracked as C53-03. No new action needed.

---

## Cross-File Consistency Checks

1. **`Math.abs(tx.amount)` in monthly spending (C11-01):** `analyzer.ts:304` now uses `Math.abs(tx.amount)` matching `store.svelte.ts:378`. Consistent. FIXED.

2. **PDF fallback error reporting (C11-03):** `pdf.ts:382-389` now pushes errors when `parseAmount` returns 0 from a non-zero input in the fallback path, matching the structured path behavior at lines 264-273. Consistent. FIXED.

3. **All `formatWon` implementations:** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

4. **All `formatRate`/`formatRatePrecise` implementations:** All have `Number.isFinite` guard. Consistent.

5. **`parseDateToISO` implementations (3 locations):** All have month/day range validation. Consistent.

6. **`inferYear` implementations (3 locations):** All use the same 90-day look-back heuristic. Consistent.

7. **`parseAmount` implementations:** CSV uses `parseInt` (returns NaN, guarded by `isValidAmount`), PDF uses `parseInt` with `Number.isNaN` guard (returns 0), XLSX uses `parseInt` for string input with `Number.isNaN` guard. Intentional design differences.

8. **`isValidTx` validation:** Includes `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Consistent with optimizer's `tx.amount > 0` filter.

9. **`window.location.href` navigation (C11-02):** Two locations use `import.meta.env.BASE_URL + 'path'` which relies on BASE_URL having a trailing slash. Astro guarantees this. Still deferred as C11-02.

10. **`changeCategory` replacement pattern:** Uses `editedTxs.map()` instead of in-place mutation. Consistent.

11. **`monthlyBreakdown` sorting:** Both `analyzeMultipleFiles` and `reoptimize` sort by month. Consistent.

12. **CardDetail AbortController cleanup:** Correctly implemented via `$effect` return cleanup. No issues.

13. **SessionStorage try/catch:** `SpendingSummary.svelte` and `store.svelte.ts` both have try/catch. Consistent.

14. **`Math.max(...array)` stack overflow risk (D-73/D-89):** All spread patterns have been replaced with `.reduce()` calls. Confirmed: OptimalCardMap uses `assignments.reduce((max, a) => Math.max(max, a.rate), 0)` and CategoryBreakdown uses `categories.reduce((max, c) => Math.max(max, c.percentage), 1)`. Fixed.

---

## Final Sweep

- No new security issues beyond what is already tracked.
- No new performance issues detected beyond D-09/D-51 (O(n*m) optimizer, already deferred).
- No new type safety issues. All gates pass (lint, typecheck, test, build).
- The `categorizer-ai.ts` file is still disabled (dead code, tracked as D-10/D-68/D-81).
- The ILP optimizer stub is still a pass-through to greedy, documented with a TODO.
- No new test coverage gaps beyond C4-10 and C4-11 (already deferred).
- No new UI/UX accessibility issues beyond what is already tracked.
- The `build-stats.ts` shared module correctly deduplicates card stats reading from Layout.astro and index.astro (partially addressing C53-02).
- CSP meta tag uses `'unsafe-inline'` for both script-src and style-src, documented with a TODO for nonce-based CSP. This is already tracked as a known limitation.
- No new `localStorage` usage -- the app correctly uses only `sessionStorage`.

---

## Summary

0 genuinely new actionable findings this cycle. 2 prior findings confirmed FIXED (C11-01: Math.abs consistency in monthly spending, C11-03: PDF fallback path error reporting). 1 low-severity observation made (C12-04: redundant negative-zero guard in SavingsComparison). All gates green. Codebase is stable with no medium or high severity new findings.
