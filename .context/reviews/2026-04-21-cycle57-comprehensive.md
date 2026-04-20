# Comprehensive Code Review -- Cycle 57

**Reviewer:** Full codebase review (cycle 57 of 100)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Gates:** eslint (no config -- N/A), tsc --noEmit (PASS), vitest (PASS, 189 tests), bun test (PASS, 57 tests)

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-56 reviews and the aggregate. Ran all gates. Focused on finding genuinely NEW issues not previously reported.

Targeted searches performed:
1. Bare `isNaN()` calls -- none found (all use `Number.isNaN()`)
2. `parseInt()` without radix -- none found (all use `parseInt(x, 10)`)
3. `any` type usage in web app -- 0 occurrences in app code (only in store.svelte.ts validated parsing paths, which were already flagged as D-107)
4. Bare `catch {}` blocks -- none found in app source
5. `innerHTML` / XSS vectors -- none found
6. `Math.max(...)` spread with unbounded arrays -- none found
7. `window.` usage -- 10 occurrences, all safe (navigation, hash, matchMedia, location)

---

## Verification of Prior Cycle Fixes (Re-confirmed from C56 aggregate)

All prior cycle 1-56 findings are confirmed fixed except as noted in the aggregate's OPEN items.

---

## New Findings

### C57-01: SavingsComparison displayedAnnualSavings incorrectly uses Math.abs for negative savings

- **Severity:** MEDIUM
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:55,60`
- **Description:** When the user prefers reduced motion, line 55 computes `displayedAnnualSavings = (target >= 0 ? target : Math.abs(target)) * 12`. This means when `target` is negative (cherry-picking is suboptimal), the annual projection shows a POSITIVE number (the absolute value times 12). The same logic applies on line 60 for the animation path: `const annualTarget = (target >= 0 ? target : Math.abs(target)) * 12`. The template on line 219 uses `opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'` which correctly shows "추가 비용" for negative savings, but the NUMBER shown is the absolute value. This creates a semantic mismatch: the label says "추가 비용" but the number is displayed as if it were a savings amount without a minus sign. Compare with line 217 where `displayedSavings` preserves the sign (the `formatWon` function handles the negative sign), but `displayedAnnualSavings` is always non-negative.
- **Failure scenario:** User has a statement where cherry-picking yields 50,000 less than the best single card. `savingsVsSingleCard` is -50000. The monthly display shows "-50,000원 추가 비용" (correct). The annual display shows "600,000원 추가 비용" -- the number is correct in magnitude but the sign is stripped, making it inconsistent with `formatWon` which would render negative numbers with a minus sign. If the template ever changes to use `formatWon(displayedAnnualSavings)` instead of raw formatting, the sign would be wrong.
- **Fix:** Change lines 55 and 60 to use `target * 12` consistently (removing the `Math.abs` conditional). The `formatWon` function on line 219 can handle negative numbers properly. If the current rendering is intentional (always show positive annual with label context), add a comment explaining why `Math.abs` is used for the annual projection.

### C57-02: ReportContent savings display uses raw sign prefix without formatWon sign handling

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/report/ReportContent.svelte:48`
- **Description:** Line 48 computes `(opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)`. When `savingsVsSingleCard` is negative, `formatWon` already renders the minus sign (e.g., "-50,000원"). The ternary adds an empty string, so the result is "-50,000원" -- correct. But when savings is exactly 0, `formatWon(0)` returns "0원" and the ternary adds "+" because `0 >= 0` is true, rendering "+0원". This is inconsistent with SavingsComparison.svelte which was fixed in C56-01 to suppress the "+" when the value rounds to zero. The report page shows "+0원" for zero savings.
- **Failure scenario:** User gets exactly zero savings (identical cherry-pick vs single-card result). Report page shows "+0원" while dashboard shows "0원".
- **Fix:** Change to `(opt.savingsVsSingleCard > 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)` to match the dashboard behavior (no plus sign for zero).

### C57-03: FileDropzone navigation uses window.location.href causing full page reload

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:238`
- **Description:** Line 238 uses `window.location.href = buildPageUrl('dashboard')` to navigate after successful upload. This causes a full page reload, losing the Astro View Transition animation and potentially the Svelte component state. The same pattern exists in CardDetail.svelte:267. This is already tracked as C19-04/C19-05 in the deferred items but is called out again for completeness.
- **Status:** Already deferred (C19-04/C19-05).

### C57-04: cachedCategoryLabels not invalidated on explicit store reset when loadCategories returns stale data

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/lib/store.svelte.ts:317-324`
- **Description:** In `createAnalysisStore`, `cachedCategoryLabels` is set to `undefined` in the `reset()` method (line 514), and `invalidateAnalyzerCaches()` is called. However, `loadCategories()` in `cards.ts` has its own module-level `categoriesPromise` cache that is NOT invalidated by `invalidateAnalyzerCaches()`. After a store reset, the next call to `getCategoryLabels()` will call `loadCategories()`, which returns the cached promise from the previous fetch. If the categories.json was redeployed on the server between fetches, the store will use stale category labels. This is already tracked as C21-04/C23-02/C25-02/C26-03 in the aggregate.
- **Status:** Already deferred (C21-04/C23-02/C25-02/C26-03).

### C57-05: CardGrid issuer filter shows only issuers from the currently type-filtered set

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/cards/CardGrid.svelte:22`
- **Description:** Line 22 derives `availableIssuers` from `filteredCards` (which already has the type filter applied). This means when the user selects "체크카드" as the type filter, the issuer list only shows issuers that have check cards. If the user then wants to switch back to "전체" type but first clicks an issuer from the filtered list, the UX flow works correctly. However, the issuer list changes dynamically with the type filter, which can be confusing -- a previously selected issuer may disappear from the list. The `$effect` on line 27-30 handles resetting `issuerFilter` when the selected issuer is no longer available, but the dynamic nature of the issuer list itself is a UX consideration. This is a design choice, not a bug, but worth noting.
- **Status:** Design observation, not a bug.

---

## Summary of Genuinely New Findings (not already fixed or deferred)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C57-01 | MEDIUM | HIGH | `SavingsComparison.svelte:55,60` | displayedAnnualSavings uses Math.abs for negative savings, making the annual projection always positive while the label says "추가 비용" | NEW |
| C57-02 | LOW | MEDIUM | `ReportContent.svelte:48` | Report shows "+0원" for zero savings due to `>= 0` check instead of `> 0` | NEW |

C57-03 is already deferred (C19-04/C19-05).
C57-04 is already deferred (C21-04/C23-02/C25-02/C26-03).
C57-05 is a design observation, not a bug.

---

## Still-Open Deferred Findings (carried forward)

All 13+ deferred findings from the aggregate remain unchanged with documented rationale. No changes to deferred items this cycle.

---

## Gate Results

| Gate | Status | Details |
|---|---|---|
| tsc --noEmit | PASS | No type errors |
| eslint | N/A | No eslint.config.js in this repo |
| vitest | PASS | 189 tests passing across 8 files |
| bun test | PASS | 57 tests passing across 3 files |
