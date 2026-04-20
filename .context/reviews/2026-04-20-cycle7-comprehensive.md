# Comprehensive Code Review -- Cycle 7 (2026-04-20)

**Reviewer:** Full codebase deep review (cycle 7 of 100)
**Scope:** Full repository -- all packages, apps, and shared code (40+ source files)
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Gates:** lint (0 errors), typecheck (0 errors), test (266 pass, 0 fail), build (pending)

---

## Methodology

Read every source file in the repository end-to-end. Cross-referenced with prior cycle 1-53 reviews and the cycle 6 aggregate. Focused on finding genuinely NEW issues not previously reported.

Targeted searches performed:
1. Bare `catch {}` blocks -- 2 occurrences in app code (both documented: D-106 variant in store.svelte.ts:134,225,235 and SpendingSummary.svelte:130 inline handler; plus pdf.ts:284 documented as D-106; plus TransactionReview.svelte:70, CardDetail.svelte:34, parser/index.ts:34)
2. `as any` usage -- 0 in app source code (3 in test file with eslint-disable comments, acceptable)
3. `innerHTML` / XSS vectors -- none found
4. `localStorage` usage -- none found (all migrated to sessionStorage)
5. `window.` usage -- 9 occurrences, all safe (hash navigation, scroll, href)
6. `parseInt()` without radix -- none found (all use `parseInt(x, 10)`)
7. Negative-zero handling in formatters -- all guarded
8. `Number.isFinite` guards on numeric formatters -- all present
9. `console.log/debug/info` in web code -- none found (3 `console.warn` in build-stats.ts, csv.ts, and reward.ts only)
10. CSP header -- present with documented `unsafe-inline` justification
11. `prefers-reduced-motion` -- handled in app.css
12. Skip-to-content link -- present in Layout.astro
13. ARIA roles on interactive elements -- all present and correct
14. AI categorizer -- properly disabled with safe stubs
15. `.slice(0, 7)` without length guard -- checked all 9 occurrences; 3 in production code are guarded, but test file has 3 unguarded instances

---

## Verification of Prior Cycle Fixes (All Confirmed)

All prior findings confirmed fixed per cycle 6 aggregate verification table. No regressions detected.

---

## Cross-File Consistency Verification (Complete Inventory)

All cross-file consistency checks from cycle 6 still pass:
1. All `formatWon` implementations (4 total) -- consistent with `Number.isFinite` guard + negative-zero normalization
2. All `formatRate` implementations (5 total) -- consistent with `Number.isFinite` guard
3. All `parseDateToISO` implementations (3 total) -- consistent with range validation
4. All `inferYear` implementations (3 total) -- identical 90-day look-back heuristic
5. All `parseAmount` implementations (3 total) -- consistent with `Number.isNaN` checks
6. Global cap rollback logic in `reward.ts:316-317` -- correct
7. SessionStorage validation via `isValidTx` -- has both `Number.isFinite` and `> 0` checks
8. Optimizer greedy marginal scoring -- correct delta calculation
9. `cachedCoreRules` module-level cache -- intentionally never invalidated (static data)
10. C5-01 `parseInt` NaN guard -- confirmed fixed at SpendingSummary.svelte:119-121
11. C6-03 date length guard -- confirmed in analyzer.ts:300-302, analyzer.ts:237-239, and store.svelte.ts:376-378

---

## New Findings

### C7-01: Test file `analyzer-adapter.test.ts:236,271` uses `slice(0, 7)` without length guard

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/__tests__/analyzer-adapter.test.ts:236,271`
- **Description:** The test file reproduces the `getLatestMonth` function locally at line 23-33, and correctly includes the `tx.date.length >= 7` guard. However, the multi-month test section at line 236 and line 271 uses `tx.date.slice(0, 7)` directly without a length guard, unlike the production `analyzer.ts` code. This is a test-code inconsistency -- the test's monthlyBreakdown and previousMonthSpending calculations at lines 236 and 271 don't guard against short dates, while the production code at `analyzer.ts:300-302` does.
- **Failure scenario:** If test fixtures were ever changed to include short/malformed dates, the test's local calculation would produce different results from the production code, leading to a false test pass when the production code is actually correct (it skips malformed dates) while the test expects them to be included.
- **Fix:** Add the same `if (tx.date.length >= 7)` guard in the test's local monthlySpending calculation at lines 236 and 271 to mirror the production code exactly.

---

## Summary of Genuinely New Findings (not already fixed or deferred)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C7-01 | LOW | MEDIUM | `analyzer-adapter.test.ts:236,271` | Test `slice(0, 7)` without length guard, inconsistent with production code | NEW |

**Only 1 genuinely new finding this cycle: C7-01 (LOW/MEDIUM).**

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05/D-42/D-46/D-64/D-78/D-96 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C4-14/D-44 | LOW | Stale fallback values in Layout footer |
| C9-04/D-71 | LOW | Complex fallback date regex in PDF parser |
| C9-06/D-59/D-72 | LOW | Percentage rounding can shift "other" threshold |
| C9-07/D-73/D-89 | LOW | Math.max spread stack overflow risk (theoretical) |
| C9-09/D-07/D-54 | LOW | Categories cache never invalidated |
| C9-10/D-52/D-75 | LOW | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12/D-76 | LOW | Module-level cache persists across store resets |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |
| C3-01/C4-01 | LOW | `build-stats.ts:25` catch block misleading message (now more accurate after fix) |
| D-66 | LOW | CardGrid issuer filter shows issuers with 0 cards after type filter |
| D-01 through D-111 | Various | See deferred items file for full list |
