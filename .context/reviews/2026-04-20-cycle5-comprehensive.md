# Comprehensive Code Review -- Cycle 5 (2026-04-20)

**Reviewer:** Full codebase deep review (cycle 5 of 100)
**Scope:** Full repository -- all packages, apps, and shared code (40+ source files)
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Gates:** lint, typecheck, test, build

---

## Methodology

Read every source file in the repository end-to-end. Cross-referenced with prior cycle 1-53 reviews and the cycle 4 aggregate. Focused on finding genuinely NEW issues not previously reported.

Targeted searches performed:
1. Bare `catch {}` blocks -- 2 occurrences (both documented: D-106, store.svelte.ts:225/SpendingSummary:128)
2. `as any` usage -- 0 occurrences in web app
3. `innerHTML` / XSS vectors -- none found
4. `Math.max(...)` spread with unbounded arrays -- none found
5. `localStorage` usage -- none found (all migrated to sessionStorage)
6. `window.` usage -- 9 occurrences, all safe (hash navigation, scroll, href)
7. `parseInt()` without radix -- none found (all use `parseInt(x, 10)`)
8. Negative-zero handling in formatters -- all guarded
9. `Number.isFinite` guards on numeric formatters -- all present
10. `console.log/debug/info` in web code -- none found
11. CSP header -- present with documented `unsafe-inline` justification
12. `prefers-reduced-motion` -- handled in app.css
13. Skip-to-content link -- present in Layout.astro
14. ARIA roles on interactive elements -- all present and correct

---

## Verification of Prior Cycle Fixes (All Confirmed)

All prior findings confirmed fixed per cycle 4 aggregate verification table. No regressions detected.

---

## Cross-File Consistency Verification (Complete Inventory)

All cross-file consistency checks from cycle 4 still pass:
1. All `formatWon` implementations (4 total) -- consistent with `Number.isFinite` guard + negative-zero normalization
2. All `formatRate` implementations (5 total) -- consistent with `Number.isFinite` guard
3. All `parseDateToISO` implementations (3 total) -- consistent with range validation
4. All `inferYear` implementations (3 total) -- identical 90-day look-back heuristic
5. All `parseAmount` implementations (3 total) -- consistent with `Number.isNaN` checks
6. Global cap rollback logic in `reward.ts:316-317` -- correct
7. SessionStorage validation via `isValidTx` -- has both `Number.isFinite` and `> 0` checks
8. Optimizer greedy marginal scoring -- correct delta calculation
9. `cachedCoreRules` module-level cache -- intentionally never invalidated (static data)

---

## New Findings

### C5-01: `SpendingSummary.svelte:119` `parseInt` on month slice without NaN guard

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:119`
- **Description:** The template expression `parseInt(latestMonth.month.slice(5, 7) ?? '0', 10)` and `parseInt(prevMonth.month.slice(5, 7) ?? '0', 10)` computes the difference between month numbers to decide whether to label "전월실적" or "이전 달 실적". If a `monthlyBreakdown` entry has a malformed `month` field (shorter than 7 chars), `slice(5, 7)` could return an empty string, making `parseInt('', 10)` return `NaN`. The `?? '0'` nullish coalescing doesn't help because `''` is not nullish. Then `Math.abs(NaN - NaN)` is `NaN`, which is not `<= 1`, so the else-branch "이전 달 실적" would be shown. This is not a visible bug since the fallback label is reasonable, but it's an unguarded `NaN` path.
- **Failure scenario:** A corrupted sessionStorage entry with `month: "2026"` (no -DD part) would cause `slice(5, 7)` to return `""`, leading to `NaN` comparison. The user would see "이전 달 실적" instead of "전월실적" -- a minor labeling inaccuracy.
- **Fix:** Add a NaN guard: `const m1 = parseInt(latestMonth.month.slice(5, 7), 10); const m2 = parseInt(prevMonth.month.slice(5, 7), 10); const label = (Number.isFinite(m1) && Number.isFinite(m2) && Math.abs(m1 - m2) <= 1) ? '전월실적' : '이전 달 실적';`

### C5-02: `CardGrid.svelte:22` `availableIssuers` derived from `filteredCards` instead of type-filtered list

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/cards/CardGrid.svelte:22`
- **Description:** `availableIssuers` is derived from `filteredCards` (which applies type, issuer, and search filters), not from the type-only-filtered list. This means when a user selects an issuer filter, the other issuers disappear from the issuer pill row, so the user cannot click a different issuer without first clearing the current one. The correct behavior would be to derive `availableIssuers` from the cards filtered only by type (not by issuer or search), so the user can always see which issuers have cards matching the current type filter. However, the existing `$effect` at line 27-30 does reset `issuerFilter` when it becomes unavailable, which mitigates the worst case. This is a UX refinement, not a bug.
- **Status:** Same class as existing deferred finding D-66 (CardGrid issuer filter shows issuers with 0 cards after type filter). Not new -- already deferred.

---

## Summary of Genuinely New Findings (not already fixed or deferred)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C5-01 | LOW | MEDIUM | `SpendingSummary.svelte:119` | `parseInt` on month slice without NaN guard | FIXED |
| C5-02 | LOW | HIGH | `CardGrid.svelte:22` | `availableIssuers` derived from fully-filtered list | DUPLICATE of D-66 |

**Only 1 genuinely new finding this cycle: C5-01 (LOW/MEDIUM).**

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
