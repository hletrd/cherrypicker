# Cycle 21 Implementation Plan

## New Findings to Address

### C21-01 (MEDIUM): VisibilityToggle $effect uses getElementById on every run
- **File:** `apps/web/src/components/ui/VisibilityToggle.svelte`
- **Problem:** The `$effect` re-queries DOM elements by ID every time it runs. During Astro client-side navigation, stale element references from the old page could be populated before being torn down.
- **Fix:** Use `bind:this` refs instead of `getElementById` for the data content and empty state elements. For the stat elements that may not exist on all pages, use a single query at mount time and cache the refs. Add a guard that skips population when the component is not mounted on the results page.
- **Status:** TODO

### C21-03 (LOW): csv.ts parseAmount uses parseInt instead of Math.round
- **File:** `apps/web/src/lib/parser/csv.ts`
- **Problem:** `parseAmount` uses `parseInt` which truncates decimal values, inconsistent with xlsx parser's `Math.round(parseFloat(...))` (C20-01 fix). For KRW this is irrelevant but the inconsistency is a maintenance risk.
- **Fix:** Change `parseInt(cleaned, 10)` to `Math.round(parseFloat(cleaned))` in `csv.ts:39` to match the xlsx parser's approach.
- **Status:** TODO

### C21-05 (LOW): FileDropzone fileInputEl bound to two inputs
- **File:** `apps/web/src/components/upload/FileDropzone.svelte`
- **Problem:** `fileInputEl` is bound to both the "파일 추가" input and the primary drop zone input. Resetting `fileInputEl.value = ''` only resets the last bound input.
- **Fix:** Use separate refs for the two file inputs, or remove `bind:this` from one and use a different mechanism for resetting. The simplest fix: add a `primaryFileInputEl` and `addFileInputEl` ref, resetting both in `clearAllFiles()` and `removeFile()`.
- **Status:** TODO

## Previously Open Findings Addressable This Cycle

### C8-10 (LOW): csv.ts installment NaN implicitly filtered by `> 1`
- **File:** `apps/web/src/lib/parser/csv.ts`
- **Problem:** `inst > 1` silently filters NaN installment values without reporting an error. If a CSV cell contains a non-numeric installment value (e.g., "일시불"), the transaction is included but the malformed installment is silently dropped.
- **Fix:** Add explicit NaN check before the `> 1` comparison. If the value is non-empty and NaN, report a parse error. This is a minimal, safe change.
- **Status:** TODO

### C8-11 (LOW): pdf.ts fallback date regex could match decimals like "3.5"
- **File:** `apps/web/src/lib/parser/pdf.ts`
- **Problem:** The `SHORT_MD_DATE_PATTERN` (`/^\d{1,2}[.\-\/]\d{1,2}$/`) would match "3.5" as a valid MM.DD date. This could produce incorrect date parsing from numeric amounts that happen to look like short dates.
- **Fix:** Add a validation step after the regex match to check that the captured month/day are within valid ranges (1-12 and 1-31 respectively). The `parseDateStringToISO` function already validates ranges, but the `findDateCell` function uses the raw pattern before calling `parseDateStringToISO`. The fix should add range validation to `findDateCell` or tighten the regex to require at least 2-digit day values.
- **Status:** TODO

## Deferred Items

### C21-02 (LOW): cards.ts shared fetch AbortSignal race
- **Reason for deferral:** The race window is extremely narrow (milliseconds between component mount/unmount). The cache is reset to null after abort, allowing an immediate retry. Fixing properly would require a ref-counted or subscriber-based cache, which is a non-trivial refactor for a theoretical edge case.
- **Exit criterion:** Multiple concurrent consumers of `loadCardsData()` with different AbortSignals observed in practice, or a subscriber-based cache is implemented as part of a broader state management refactor.

### C21-04 (LOW): cachedCategoryLabels never invalidated
- **Reason for deferral:** categories.json is a static file from the build that never changes within a session. The cache is cleared on `reset()`. Theoretical concern only.
- **Exit criterion:** If categories.json becomes dynamically fetched from an API that can return different data within a session.
