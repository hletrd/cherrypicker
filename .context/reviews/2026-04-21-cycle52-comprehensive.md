# Comprehensive Code Review -- Cycle 52

**Date:** 2026-04-21
**Reviewer:** Single-agent comprehensive review (cycle 52 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-51 reviews and the aggregate. Ran `npx tsc --noEmit` (0 errors across all 7 workspaces), `npx vitest run` (189 pass, 0 fail), `bun test packages/parser tools/scraper` (58 pass, 0 fail). ESLint is N/A -- no eslint.config.js at repo root. Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-51 findings are confirmed fixed except as noted in the aggregate. No regressions detected. Specifically verified:

- C51-01 (Report page plain JS): **PARTIALLY FIXED** -- `report.astro` now uses `ReportContent.svelte` + `VisibilityToggle.svelte` instead of loading `report.js`. However, the `report.js` file itself still exists in `public/scripts/` as dead code (see C52-02).
- C51-04 (OptimalCardMap toggleRow Set copy): **FIXED** -- `toggleRow` now directly calls `.add()`/`.delete()` on the `$state` Set instead of creating a new Set copy.
- All prior HIGH/MEDIUM findings from cycles 1-50 remain resolved.

---

## Previously Open Findings -- Re-verification

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present. No deferred items have been resolved since cycle 51.

---

## New Findings

### C52-01: CSV parser doesn't strip UTF-8 BOM, causing header detection failure

**Severity:** MEDIUM
**Confidence:** HIGH
**File:** `apps/web/src/lib/parser/csv.ts:120,139,148-161`
**Description:** The XLSX parser correctly strips UTF-8 BOM (`\uFEFF`) from the first 512 bytes before processing (line 248 of `xlsx.ts`). However, the CSV parser does NOT strip BOM from the file content before splitting into lines and detecting headers. When a Korean bank exports a CSV file with a UTF-8 BOM (common in Windows-generated exports), the first cell of the header row will contain the BOM character (e.g., `"\uFEFF이용일"` instead of `"이용일"`). This causes:
1. **Bank-specific adapters fail:** `headers.indexOf('이용일')` won't match `"\uFEFF이용일"`, so all 10 bank-specific adapters will fail header detection and return empty results with "헤더 행을 찾을 수 없습니다" error.
2. **Generic CSV parser also affected:** The `isDateLike()` and `isAmountLike()` regex tests on `.trim()` values won't match BOM-prefixed cells either, because `trim()` only strips whitespace, not BOM characters. The header detection regex `/이용일|거래일|날짜|.../` also won't match BOM-prefixed header cells.
3. **Complete parse failure:** For BOM-prefixed CSV files, the entire CSV parser produces zero transactions. This is a common scenario since many Korean bank CSV exports are generated on Windows systems that add BOM.

**Failure scenario:** User downloads a CSV from a Korean bank website using Internet Explorer or Edge on Windows, which adds a UTF-8 BOM. Uploads the file. The parser returns "거래 내역을 찾을 수 없어요" even though the file contains valid transactions.

**Fix:** Add BOM stripping at the top of `parseCSV()`:
```ts
// Strip UTF-8 BOM if present — Windows-generated CSV exports commonly include it
const contentNoBOM = content.replace(/^\uFEFF/, '');
```
Apply to both `parseCSV()` and `parseGenericCSV()` entry points, or strip once before the first `content.split('\n')` call.

### C52-02: report.js is dead code -- no longer loaded by report.astro

**Severity:** LOW
**Confidence:** HIGH
**File:** `apps/web/public/scripts/report.js`
**Description:** The `report.astro` page was refactored in a prior cycle to use `ReportContent.svelte` and `VisibilityToggle.svelte` instead of loading `report.js` via a `<script>` tag. The `report.js` file is now dead code:
1. It references `#report-content` element which no longer exists in the current template (the template uses `#report-data-content` and `#report-empty-state`).
2. No `<script>` tag in `report.astro` loads `report.js`.
3. The file is still served statically via `public/scripts/` and can be loaded by any page, but it will never execute successfully because its target DOM element doesn't exist.
4. It contains its own `formatWon` function that lacks the negative-zero guard present in the shared `formatters.ts`, but since it's dead code this is moot.
**Fix:** Delete `apps/web/public/scripts/report.js`. It has been superseded by `ReportContent.svelte`.

### C52-03: Layout.astro hardcoded script path doesn't use BASE_URL variable

**Severity:** LOW
**Confidence:** HIGH
**File:** `apps/web/src/layouts/Layout.astro:46`
**Description:** The layout template hardcodes the script path: `<script is:inline src="/cherrypicker/scripts/layout.js"></script>`. All other resource references in the same file use the `${base}` variable (derived from `import.meta.env.BASE_URL`) for constructing URLs (e.g., line 54: `href={\`${base}\`}`, line 68: `href={\`${base}dashboard\`}`). If the app is deployed under a different base path (e.g., `/` instead of `/cherrypicker/`), the layout.js script will fail to load because the path is hardcoded. This would break the dark mode toggle and mobile menu on such deployments.
**Fix:** Use the `${base}` variable for the script src:
```html
<script is:inline src={`${base}scripts/layout.js`}></script>
```
Note: Astro's `<script is:inline>` with dynamic attributes may need special handling. An alternative is to use `<script is:inline>` with the base URL injected via a data attribute or a meta tag.

---

## Final Sweep -- Cross-File Interactions

1. **BOM handling parity (NEW FINDING):**
   - XLSX: `xlsx.ts:248` strips BOM before `isHTMLContent()` check -- CORRECT
   - CSV: `csv.ts` does NOT strip BOM -- **BUG (C52-01)**
   - PDF: Not applicable (binary format, parsed by pdfjs-dist)

2. **Report page architecture (VERIFICATION):**
   - `report.astro` now uses `ReportContent.svelte` (client:load) + `VisibilityToggle.svelte` (client:load)
   - `report.js` no longer loaded -- confirmed C51-01 is partially fixed
   - `ReportContent.svelte` reads from `analysisStore` (correct, consistent with other pages)
   - `ReportContent.svelte` uses `formatWon` from `formatters.ts` (correct, includes negative-zero guard)
   - `ReportContent.svelte` includes dark mode classes (correct)
   - `report.js` is dead code (C52-02)

3. **Negative-amount handling consistency (COMPLETE INVENTORY):**
   - All 10 web CSV adapters: `amount <= 0` -- CORRECT
   - Web CSV generic: `amount <= 0` -- CORRECT
   - Web XLSX: `amount <= 0` -- CORRECT
   - Web PDF structured: `amount <= 0` -- CORRECT
   - Web PDF fallback: `amount > 0` -- CORRECT
   - All downstream: CORRECT (verified in prior cycles)

4. **SessionStorage persistence:**
   - Main key: `cherrypicker:analysis` -- managed by `clearStorage()`
   - Dismiss key: `cherrypicker:dismissed-warning` -- NOT cleared by `clearStorage()` (C4-07/C51-02, still open)
   - Both keys are in `sessionStorage` (cleared on tab close), so the impact is limited

5. **Script loading paths:**
   - `layout.js`: hardcoded `/cherrypicker/scripts/layout.js` -- C52-03
   - `report.js`: exists in `public/scripts/` but no longer loaded -- C52-02
   - `dashboard.js`, `results.js`: exist in `public/scripts/` but not loaded by any Svelte component

6. **Build-stats deduplication (C53-02 FIX VERIFIED):**
   - `build-stats.ts` shared `readCardStats()` function
   - Used by both `index.astro` and `Layout.astro`
   - Fallback values defined in ONE place -- CONSISTENT

7. **OptimalCardMap toggleRow (C51-04 FIX VERIFIED):**
   - `toggleRow` at line 37-43 now uses `.add()`/`.delete()` directly on `$state` Set
   - No longer creates a new Set copy on every toggle -- CORRECT

8. **CategoryBreakdown CATEGORY_COLORS dark mode contrast:**
   - C8-05/C4-09 still open -- some utility colors (`gas: '#fb923c'`, `water: '#38bdf8'`, `electricity: '#facc15'`) may have insufficient contrast in dark mode
   - These are in the `CATEGORY_COLORS` map in `CategoryBreakdown.svelte:7-49`
   - Deferred (LOW) per prior cycles

---

## Code Quality Observations (No Action Required)

- All parsers consistently use `Math.round(parseFloat(...))` for amount parsing
- All parsers consistently filter `amount <= 0` transactions
- Store persistence handles edge cases (quota exceeded, corrupted data, truncated transactions)
- Svelte components use proper `$state`, `$derived`, `$effect` runes with cleanup
- AbortController pattern is consistently applied in `cards.ts` and `CardDetail.svelte`
- Korean i18n is consistent across all UI components
- Dark mode classes are present on all colored elements
- `isSubstringSafeKeyword` in `matcher.ts:21-23` is still dead code (C49-01, unchanged)

---

## Gate Results

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | PASS (0 errors across all 7 workspaces) |
| `npx vitest run` | PASS (189 tests, 8 files, 0 failures) |
| `bun test packages/parser tools/scraper` | PASS (58 tests, 4 files, 0 failures) |
| `eslint` | N/A -- no eslint.config.js at repo root; linting not configured |

---

## Summary

3 new findings identified in this cycle:
- **C52-01 (MEDIUM):** CSV parser doesn't strip UTF-8 BOM, causing complete parse failure for Windows-generated CSV exports. The XLSX parser already handles BOM correctly.
- **C52-02 (LOW):** `report.js` is dead code -- the report page was refactored to use Svelte components, but the old plain JS file was not deleted.
- **C52-03 (LOW):** `Layout.astro` hardcodes the layout.js script path instead of using the `BASE_URL` variable.

All HIGH and MEDIUM severity findings from prior cycles remain resolved. The codebase is in a stable, well-maintained state with the CSV BOM issue being the most impactful new finding.
