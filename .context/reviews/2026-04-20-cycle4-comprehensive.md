# Comprehensive Code Review -- Cycle 4 (2026-04-20)

**Reviewer:** Full codebase deep review (cycle 4 of 100)
**Scope:** Full repository -- all packages, apps, and shared code (40+ source files)
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Gates:** lint (0 errors), typecheck (0 errors), test (266 pass, 0 fail), build (success)

---

## Methodology

Read every source file in the repository. Cross-referenced with prior cycle 1-53 reviews and the aggregate. Ran all gates. Focused on finding genuinely NEW issues not previously reported.

Targeted searches performed:
1. Bare `isNaN()` calls -- none found (all use `Number.isNaN()`)
2. `parseInt()` without radix -- none found (all use `parseInt(x, 10)`)
3. `any` type usage in web app -- 4 occurrences, all in validated parsing paths
4. Bare `catch {}` blocks -- 2 occurrences, both documented (D-106, D-107)
5. `innerHTML` / XSS vectors -- none found
6. `Math.max(...)` spread with unbounded arrays -- none found
7. `console.log/debug/info` in web code -- none found
8. `window.` usage -- 9 occurrences, all safe navigation/hash operations
9. Negative-zero handling in formatters -- all guarded
10. `Number.isFinite` guards on numeric formatters -- all present

---

## Verification of Prior Cycle Fixes (All Confirmed)

| Fix | Status | Evidence |
|-----|--------|----------|
| C7-01: formatRate in SavingsComparison | FIXED | `SavingsComparison.svelte:262` uses `formatRate(card.rate)` |
| C7-02: formatRatePrecise in SpendingSummary | FIXED | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03: formatRatePrecise in SavingsComparison | FIXED | `SavingsComparison.svelte:179` uses `formatRatePrecise()` |
| C7-08: PDF inferYear for short Korean dates | FIXED | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C9-01: Cache reference equality | FIXED | `analyzer.ts:47` uses null-check cache |
| C9-05: Error when reoptimize result null | FIXED | `store.svelte.ts:419` sets error |
| C9-11: isValidTx non-empty string checks | FIXED | `store.svelte.ts:143-149` |
| C9-13: monthlyBreakdown sorted | FIXED | `analyzer.ts:381` has `.sort()` |
| C10-03: XLSX parseDateToISO Infinity guard | FIXED | `xlsx.ts:195` has `Number.isFinite(raw)` check |
| C10-06: handleUpload checks error | FIXED | `FileDropzone.svelte:211` checks `analysisStore.error` |
| C10-09: reoptimize filters to latest month | FIXED | `store.svelte.ts:363-366` filters to `latestTransactions` |
| C10-13: Empty merchant name guard | FIXED | `matcher.ts:40` returns uncategorized for `lower.length < 2` |
| C47-L01: Terminal formatWon isFinite guard | FIXED | Both terminal formatters have `Number.isFinite` guard |
| C47-L02: Terminal formatRate isFinite guard | FIXED | Both terminal formatters have `Number.isFinite` guard |
| C52-01: CSV adapter failure collection | FIXED | `csv.ts:966-974` collects adapter failures |
| C52-02: TransactionReview AI array replacement | FIXED | `TransactionReview.svelte:108-130` uses `updatedTxs.map()` |
| C52-06/C4-07: sessionStorage not localStorage | FIXED | `SpendingSummary.svelte:10,128` uses `sessionStorage` |
| C53-01: changeCategory replacement pattern | FIXED | `TransactionReview.svelte:187-205` uses replacement |
| C53-02: Card stats reading dedup | FIXED | Shared `build-stats.ts` module |
| C53-03: CardDetail dark mode contrast | FIXED | `CardDetail.svelte:222` has `dark:text-blue-300` |

---

## Cross-File Consistency Verification (Complete Inventory)

1. **All `formatWon` implementations (4 total, fully consistent):**
   - `apps/web/src/lib/formatters.ts:5-9` -- `Number.isFinite` guard + negative-zero normalization
   - `packages/viz/src/report/generator.ts:10-14` -- `Number.isFinite` guard + negative-zero normalization
   - `packages/viz/src/terminal/summary.ts:5-7` -- `Number.isFinite` guard + negative-zero normalization
   - `packages/viz/src/terminal/comparison.ts:4-6` -- `Number.isFinite` guard + negative-zero normalization

2. **All `formatRate` implementations (5 total, fully consistent):**
   - `apps/web/src/lib/formatters.ts:16-19` -- `Number.isFinite` guard
   - `apps/web/src/lib/formatters.ts:34-37` (formatRatePrecise) -- `Number.isFinite` guard
   - `packages/viz/src/report/generator.ts:17-19` -- `Number.isFinite` guard
   - `packages/viz/src/terminal/summary.ts:11-13` -- `Number.isFinite` guard
   - `packages/viz/src/terminal/comparison.ts:10-12` -- `Number.isFinite` guard

3. **All `parseDateToISO` implementations (3 total, consistent):**
   - `apps/web/src/lib/parser/csv.ts:39-111` -- Full year, YYYYMMDD, short year, MM/DD, Korean dates, all with range validation
   - `apps/web/src/lib/parser/pdf.ts:146-204` -- Same patterns minus YYYYMMDD (PDF doesn't have that format), all with range validation
   - `apps/web/src/lib/parser/xlsx.ts:192-280` -- Numeric (Excel serial) + string paths, all with range validation + `Number.isFinite` for numerics

4. **All `inferYear` implementations (3 total, identical logic):**
   - `csv.ts:29-37` -- 90-day look-back heuristic
   - `pdf.ts:137-144` -- 90-day look-back heuristic
   - `xlsx.ts:183-190` -- 90-day look-back heuristic

5. **All `parseAmount` implementations (3 total, consistent):**
   - `csv.ts:114-123` -- `parseInt`, `Number.isNaN` check
   - `xlsx.ts:282-298` -- `Number.isFinite` for numerics, `parseInt` + `Number.isNaN` for strings, returns `null`
   - `pdf.ts:207-213` -- `parseInt`, returns 0 instead of NaN

6. **Global cap rollback logic in `reward.ts:316-317`:** Correct. The over-count is correctly subtracted.

7. **SessionStorage validation:** `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0`. Correct.

8. **Optimizer greedy marginal scoring:** Correct delta calculation.

9. **`cachedCoreRules` module-level cache:** Intentionally never invalidated. Static data. Not a bug.

---

## New Findings

### C4-01: `build-stats.ts` catch block logs misleading "not found" for SyntaxError

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/lib/build-stats.ts:25-30`
- **Description:** The `catch (err)` block checks `err instanceof SyntaxError` and logs "cards.json is malformed" -- which is correct. But for all other errors (ENOENT, EACCES, etc.) it logs "cards.json not found at build time" which is misleading when the actual error is a permission denied or path issue. However, the fallback values are correct regardless, so this is cosmetic.
- **Failure scenario:** `cards.json` exists but is unreadable due to file permissions. The log says "not found" instead of "unreadable", potentially confusing a developer debugging build issues.
- **Fix:** Change the else-branch message to a more generic "could not read cards.json at build time" or include the actual error code.

### C4-02: `SavingsComparison.svelte` count-up animation creates unnecessary RAF when target equals displayedSavings

- **Severity:** LOW
- **Confidence:** LOW
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:53-71`
- **Description:** The `$effect` at line 53 has `if (target === displayedSavings) return;` at line 56, which correctly avoids starting a RAF loop when there's no animation needed. However, when `target === 0 && displayedSavings === 0`, the guard at line 55 (`if (target === 0 && displayedSavings === 0) return;`) catches it first. The duplicate check at line 56 is thus redundant but harmless. Not a bug -- just a minor code clarity issue.
- **Status:** Not a real issue. Already properly handled.

### C4-03: `CategoryBreakdown.svelte` keyboard accessibility: hoveredIndex set by mouse doesn't collapse on focus loss to non-sibling

- **Severity:** MEDIUM
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:158-166`
- **Description:** The `onfocusout` handler at lines 161-166 checks `e.currentTarget?.contains(e.relatedTarget)` to avoid collapsing when focus moves to a child element. This is correct for intra-row focus movement. However, if a user navigates with keyboard from one row to a completely different part of the page (not a sibling category row), the `hoveredIndex` will remain set because `onfocusout` on the row that lost focus will see that `relatedTarget` is NOT contained within the row, and it sets `hoveredIndex = null`. Wait -- that IS correct behavior. Let me re-read... The handler sets `hoveredIndex = null` when focus leaves the row entirely. And `onfocusin` on the new row sets `hoveredIndex = i`. This means keyboard navigation should work correctly. The only gap is that if the user uses Tab to move PAST all the category rows (to a button below, for example), `hoveredIndex` becomes null. That's correct UX.
- **Re-analysis after re-reading:** Actually this is working correctly. The prior cycle's C3-03 flagged this as an issue but upon careful re-reading, the `onfocusout` + `onfocusin` combination handles keyboard navigation properly. Downgrading.
- **Status:** Not a real issue. Already properly handled.

### C4-04: `OptimalCardMap.svelte` rate bar visual distortion when all rates are near-zero

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:17-24`
- **Description:** The `maxRate` computation uses a 0.5% (0.005) epsilon as a floor when all computed rates are below that threshold. This means when all rates are genuinely near-zero (e.g., 0.001, 0.002), the bars will appear proportionally sized but very small -- the smallest rate bar might be only 20% width of a 100px bar, which is ~20px and barely visible. This is a known deferred issue (C4-13/C9-08). Not new.
- **Status:** Same class as existing deferred finding C4-13/C9-08.

### C4-05: `store.svelte.ts` reoptimize failure doesn't clear sessionStorage

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/lib/store.svelte.ts:421-427`
- **Description:** When `reoptimize` fails (the `catch` block at line 423), the error is set but sessionStorage is NOT cleared. This means stale data from the previous successful optimization persists in sessionStorage. On page refresh, `loadFromStorage()` will restore the old data, which could confuse the user if they thought the reoptimize took effect.
- **Note:** The `result === null` branch (line 417-421) does correctly call `clearStorage()`. The `catch` branch doesn't clear because `result` might still be valid from the initial analysis -- we don't want to destroy the user's data on a transient error. This is actually reasonable behavior: the old analysis result is still valid, just the reoptimize failed. The user can retry.
- **Re-analysis:** On reflection, this is the correct design. If reoptimize throws, the store still has the previous valid result. Clearing sessionStorage would destroy the user's data. The `catch` correctly only sets the error message so the UI can show a retry option. Not a bug.
- **Status:** Not a real issue. Design is correct.

### C4-06: `FileDropzone.svelte` total size check allows adding files that individually pass but collectively exceed 50MB

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:118-161`
- **Description:** The `addFiles` function checks total size AFTER filtering valid files (line 140). If a user adds files one at a time, each individual addition could pass the total size check, but adding files in a batch could hit the limit. The current logic correctly prevents exceeding the total size limit by checking after adding the new valid files. This is working as designed -- the error message is shown and the files are NOT added. Not a bug.
- **Status:** Not a real issue.

### C4-07: `SavingsComparison.svelte` annual savings projection uses simple multiplication without considering cap limits

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:205`
- **Description:** The annual projection calculates `savingsVsSingleCard * 12`. This assumes the same spending pattern every month and that monthly caps reset cleanly. However, if the user's spending varies significantly month to month, the projection could be misleading. Additionally, if monthly caps are already being hit (reducing the current month's reward), the projection would overestimate annual savings. This is a known limitation of the simple projection model and was previously deferred (C4-06/C52-03/C9-02).
- **Status:** Same class as existing deferred finding C4-06/C52-03/C9-02.

---

## Summary of Genuinely New Findings (not already fixed or deferred)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C4-01 | LOW | HIGH | `build-stats.ts:25-30` | Misleading "not found" log message for non-ENOENT errors | NEW |
| C4-02 | LOW | LOW | `SavingsComparison.svelte:56` | Duplicate guard -- not a real issue | NOT AN ISSUE |
| C4-03 | MEDIUM->LOW | MEDIUM | `CategoryBreakdown.svelte:158-166` | Keyboard accessibility -- works correctly on re-analysis | NOT AN ISSUE |
| C4-04 | LOW | MEDIUM | `OptimalCardMap.svelte:17-24` | Near-zero rate bar visibility -- same as existing deferred | DUPLICATE |
| C4-05 | LOW | HIGH | `store.svelte.ts:421-427` | Reoptimize catch doesn't clear sessionStorage -- correct design | NOT AN ISSUE |
| C4-06 | LOW | HIGH | `FileDropzone.svelte:118-161` | Total size check -- works correctly | NOT AN ISSUE |
| C4-07 | LOW | HIGH | `SavingsComparison.svelte:205` | Annual projection model -- same as existing deferred | DUPLICATE |

**Only 1 genuinely new finding this cycle: C4-01 (LOW/HIGH).**

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08 | LOW | Small-percentage bars nearly invisible |
| C4-14/C52-04 | LOW | Stale fallback values in Layout footer (partially addressed by shared module) |
| C9-04 | LOW | Complex fallback date regex in PDF parser |
| C9-06 | LOW | Percentage rounding can shift "other" threshold |
| C9-07 | LOW | Math.max spread stack overflow risk (theoretical) |
| C9-09 | LOW | Categories cache never invalidated (same as D-07/D-54) |
| C9-10 | LOW | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12 | LOW | Module-level cache persists across store resets |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |
| C3-01 | LOW | `build-stats.ts:25` catch block misleading message (now C4-01) |
| C3-02 | LOW | SavingsComparison count-up animation duplicate guard (not a real issue) |
| C3-04 | LOW | OptimalCardMap rate bar epsilon distortion (same as C4-13/C9-08) |
| C3-05 | LOW | Missing sessionStorage cleanup when reoptimize fails (correct design, not a bug) |
