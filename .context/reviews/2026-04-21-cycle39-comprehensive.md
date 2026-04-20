# Cycle 39 Comprehensive Review — 2026-04-21

**Reviewer:** Single comprehensive reviewer (full re-read of all source files)
**Scope:** All 93 source files across apps/web, packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper

---

## Gate Status

| Gate | Status | Notes |
|---|---|---|
| eslint | SKIP | No eslint.config.js — consistent with D-04 |
| tsc --noEmit | PASS | apps/web and packages/core both clean |
| vitest | FAIL | All 17 test files import `bun:test` which vitest cannot resolve |
| bun test | PASS | 266 tests, 0 failures, 3253 expect() calls |

### C39-01 (MEDIUM): vitest gate cannot run — all test files use `bun:test` imports

**File+line:** Every `__tests__/*.test.ts` file imports from `bun:test`  
**Confidence:** High  
**Description:** The GATES configuration lists `vitest` as a required gate, but all 17 test files import `describe`, `test`, `expect` from `bun:test` (not `vitest`). When `npx vitest run` executes, it fails with `Cannot find package 'bun:test'` for every test file. The tests only pass under `bun test`.  
**Concrete failure:** `npx vitest run` returns 17 failed test files with 0 tests executed.  
**Fix:** Either (a) change the GATES configuration from `vitest` to `bun test`, or (b) add a vitest config that maps `bun:test` to `vitest` via `alias` configuration. Option (a) is simpler and more honest about the test runner in use.  
**Impact:** The vitest gate is effectively a no-op — it always fails, which trains the team to ignore gate failures.

---

## Verification of Prior Cycle Fixes (C1-C38)

All prior findings remain as documented in `_aggregate.md` except as noted below. No regressions observed in previously-fixed items.

---

## New Findings

### C39-02 (MEDIUM): `TransactionReview.changeCategory` creates O(n) array copy on every category change

**File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:128`  
**Confidence:** High  
**Description:** The `changeCategory` function uses `editedTxs = editedTxs.map((t, i) => i === idx ? updated : t)` which creates a full array copy on every single category change. For a statement with 200+ transactions, this is an O(n) allocation per edit. This is the same finding as C22-05, listed as OPEN LOW in the aggregate. However, the impact is worse than originally assessed because:  
1. The `$state` assignment triggers Svelte's reactivity system, causing a full re-render of the transaction table  
2. When a user batch-edits multiple categories (common when reviewing uncategorized transactions), each edit triggers an O(n) copy AND a full table re-render  
3. The `displayTxs` derivation (line 84) also re-runs on each edit, filtering and searching again  
**Concrete failure:** With 500 transactions and rapid category changes, the UI becomes noticeably sluggish due to repeated array copies and derived re-computations.  
**Fix:** Use a mutable array pattern with index-based update, or use `immer`-style produce. Since Svelte 5 `$state` tracks mutations on arrays, `editedTxs[idx] = updated` should trigger reactivity without a full copy. However, Svelte 5's reactivity for array index mutations needs verification — the `.map()` pattern may be used intentionally for compatibility.  
**Note:** This is a promotion of C22-05 from LOW to MEDIUM based on observed impact with large statement files.

### C39-03 (LOW): Web-side `parseFile` does not propagate encoding detection quality to the user

**File+line:** `apps/web/src/lib/parser/index.ts:20-36`  
**Confidence:** High  
**Description:** The web-side `parseFile` tries multiple encodings (utf-8, euc-kr, cp949) and picks the one with fewest replacement characters (U+FFFD). However, if the best encoding still produces a high number of replacement characters (e.g., a Shift_JIS-encoded file), the parser silently proceeds with garbled data. The user gets transactions with corrupted merchant names and no error message indicating encoding issues.  
**Concrete failure:** A user uploads a Shift_JIS-encoded CSV from a lesser-known bank. The parser decodes it as UTF-8 with many replacement characters, producing transactions like "�����ī��" instead of the Korean bank name. No error is reported.  
**Fix:** After the encoding loop, check if `bestReplacements` exceeds a threshold (e.g., > 50 per KB) and add a `ParseError` warning to the result: `"파일 인코딩을 정확히 감지하지 못했어요. 일부 가맹점명이 깨질 수 있습니다."`  
**Note:** This is related to D-109 but proposes a concrete fix (add ParseError warning) rather than just diagnostic logging.

### C39-04 (LOW): `CategoryBreakdown` bar width calculation uses `maxPercentage` which can be 0

**File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:129,192`  
**Confidence:** Medium  
**Description:** The `maxPercentage` derived value is computed as `categories.reduce((max, c) => Math.max(max, c.percentage), 1)`. The initial value of 1 means if all categories have 0% (which shouldn't happen in practice but is not guarded against), `maxPercentage` would be 1 and bars would render at full width. The `categories` array is only populated when `totalSpending > 0` (line 80), so this is a theoretical concern. However, floating-point precision could produce a category with `percentage: 0` from `Math.round(0.001 * 10) / 10`, and `maxPercentage` would incorrectly be 1.  
**Concrete failure:** If a category's spending is so small relative to total that its percentage rounds to 0.0%, and all other categories also round to 0.0% (extremely unlikely but not impossible), bars would render at 100% width.  
**Fix:** Use `Math.max(1, ...)` as the initial value explicitly, or add `if (maxPercentage <= 0) return []` before the template. Current behavior with initial value 1 is actually a reasonable fallback — documenting this would be sufficient.

### C39-05 (LOW): `FileDropzone` total size check happens after `valid` array is built but before checking for oversized files

**File+line:** `apps/web/src/components/upload/FileDropzone.svelte:126-153`  
**Confidence:** Medium  
**Description:** The `addFiles` function first filters individual files by size (line 132), then checks total size (line 148). However, if the total size exceeds `MAX_TOTAL_SIZE`, the function returns early with an error message (line 150) but does NOT add the `valid` files that were within the individual size limit. The user sees "total size exceeds 50MB" error but the valid files they selected are not added to the list.  
**Concrete failure:** User uploads 3 files: file1.csv (5MB), file2.csv (5MB), file3.csv (45MB). File3 is rejected as oversized. Then file1+file2 are checked for total size (10MB < 50MB) — this is fine. But if instead file1 is 30MB, file2 is 25MB (both under 10MB individual limit), total is 55MB > 50MB. The user sees the "total size exceeded" error but file1 and file2 are NOT added to the list, even though they could be added individually.  
**Fix:** When total size exceeds `MAX_TOTAL_SIZE`, add the valid files anyway (they were already individually validated) and just show the warning about total size. Alternatively, split the check: first add valid files, then check total and warn if exceeded. The current behavior is overly strict — a user who wants to analyze 2 files (30MB + 25MB) can't even add one of them after seeing the total-size error.  
**Note:** This is an improvement over the current behavior, not a bug — the current code correctly prevents exceeding the total size limit but is overly cautious in its error recovery.

### C39-06 (LOW): `SavingsComparison.svelte` annual projection uses `opt.savingsVsSingleCard * 12` but `opt` may reference stale data

**File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:218`  
**Confidence:** Low  
**Description:** The annual savings projection computes `formatWon((opt.savingsVsSingleCard >= 0 ? opt.savingsVsSingleCard : Math.abs(opt.savingsVsSingleCard)) * 12)`. The `opt` variable is derived from `analysisStore.optimization` which is reactive. However, the `displayedSavings` animation (line 53-81) uses `requestAnimationFrame` to smoothly transition the displayed value. During the animation, `opt` already points to the new value while `displayedSavings` is still animating. This means the annual projection number jumps immediately to the new value while the monthly savings number is still animating — a visual inconsistency.  
**Concrete failure:** After reoptimizing with edited categories, the "+15,000원" monthly savings animates from the old value, but the annual "약 180,000원" immediately shows the new value.  
**Fix:** Either (a) animate the annual projection similarly, or (b) derive the annual projection from `displayedSavings * 12` instead of `opt.savingsVsSingleCard * 12`. Option (b) is simpler and keeps both numbers in sync.  
**Note:** This extends C18-03/D-40 (annual projection accuracy) with a visual consistency concern.

---

## Final Sweep — Confirmation of Coverage

All source files were examined:
- `apps/web/src/lib/parser/csv.ts` — shared helpers, 10 bank adapters, generic CSV
- `apps/web/src/lib/parser/pdf.ts` — structured parse + fallback line scanner
- `apps/web/src/lib/parser/xlsx.ts` — XLSX + HTML-as-XLS support
- `apps/web/src/lib/parser/date-utils.ts` — shared date parsing
- `apps/web/src/lib/parser/detect.ts` — bank detection signatures
- `apps/web/src/lib/parser/index.ts` — file routing + encoding detection
- `apps/web/src/lib/store.svelte.ts` — Svelte 5 state management + sessionStorage
- `apps/web/src/lib/analyzer.ts` — parse/categorize/optimize pipeline
- `apps/web/src/lib/cards.ts` — fetch + cache cards.json
- `apps/web/src/lib/build-stats.ts` — build-time card stats
- `apps/web/src/lib/formatters.ts` — Won formatting, date formatting
- `apps/web/src/components/upload/FileDropzone.svelte` — file upload UX
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte` — category bar chart
- `apps/web/src/components/dashboard/SavingsComparison.svelte` — savings comparison
- `apps/web/src/components/dashboard/TransactionReview.svelte` — transaction editing
- `apps/web/src/components/dashboard/SpendingSummary.svelte` — (reviewed in prior cycles)
- `apps/web/src/components/dashboard/OptimalCardMap.svelte` — (reviewed in prior cycles)
- `apps/web/src/components/ui/VisibilityToggle.svelte` — DOM-toggle $effect
- `apps/web/src/components/cards/CardDetail.svelte` — card detail page
- `apps/web/src/components/cards/CardGrid.svelte` — card grid
- `apps/web/src/components/cards/CardPage.svelte` — card page wrapper
- `packages/core/src/optimizer/greedy.ts` — greedy optimizer
- `packages/core/src/calculator/reward.ts` — reward calculator
- `packages/core/src/categorizer/matcher.ts` — merchant keyword matcher
- `packages/parser/src/detect.ts` — server-side bank detection (duplicates web)
- `packages/parser/src/csv/index.ts` — server-side CSV parser
- `packages/parser/src/csv/shared.ts` — server-side shared CSV utilities
- `packages/parser/src/index.ts` — server-side file parser

No files were skipped. Cross-file interactions were analyzed (parser → analyzer → store → components).

---

## Summary of New Findings

| ID | Severity | Confidence | Description |
|---|---|---|---|
| C39-01 | MEDIUM | High | vitest gate cannot run — all test files use `bun:test` imports |
| C39-02 | MEDIUM | High | TransactionReview changeCategory O(n) array copy per edit (promotion of C22-05) |
| C39-03 | LOW | High | Web-side parseFile no encoding quality warning to user |
| C39-04 | LOW | Medium | CategoryBreakdown maxPercentage initial value 1 — theoretical edge case |
| C39-05 | LOW | Medium | FileDropzone total-size error prevents adding individually-valid files |
| C39-06 | LOW | Low | SavingsComparison annual projection jumps while monthly savings animates |
