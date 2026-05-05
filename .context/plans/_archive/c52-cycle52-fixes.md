# Cycle 52 Implementation Plan

**Date:** 2026-04-21
**Source review:** `.context/reviews/2026-04-21-cycle52-comprehensive.md`
**Status:** COMPLETED

---

## Actionable Findings

### C52-01: CSV parser doesn't strip UTF-8 BOM (MEDIUM/HIGH confidence) -- FIXED

**File:** `apps/web/src/lib/parser/csv.ts:120,139,148-161`
**Problem:** The CSV parser doesn't strip UTF-8 BOM (`\uFEFF`) before processing. The XLSX parser already handles this (line 248 of `xlsx.ts`). BOM-prefixed header cells fail `indexOf` matches in all 10 bank adapters and the generic parser's regex checks, causing complete parse failure for Windows-generated CSV exports.
**Fix:**
1. Add BOM stripping at the top of `parseCSV()` before any content processing:
   ```ts
   const contentNoBOM = content.replace(/^\uFEFF/, '');
   ```
2. Use `contentNoBOM` instead of `content` for all downstream operations.
3. Also strip BOM in `parseGenericCSV()` if called directly, or ensure it's always called with pre-stripped content.
4. Add a test case for BOM-prefixed CSV parsing.

**Verification:** Upload a BOM-prefixed CSV file and confirm it parses successfully. Run existing tests.

---

### C52-02: Delete dead code `report.js` (LOW/HIGH confidence) -- FIXED

**File:** `apps/web/public/scripts/report.js`
**Problem:** The report page was refactored to use `ReportContent.svelte` + `VisibilityToggle.svelte`, but the old plain JS file was never deleted. It references a non-existent `#report-content` element.
**Fix:**
1. Delete `apps/web/public/scripts/report.js`.
2. Verify no other file references it (Grep for `report.js`).

**Verification:** Build the app, confirm no broken references. Check that the report page still works.

---

### C52-03: Layout.astro hardcoded script path (LOW/HIGH confidence) -- FIXED

**File:** `apps/web/src/layouts/Layout.astro:46`
**Problem:** The layout template hardcodes `/cherrypicker/scripts/layout.js` instead of using `${base}` variable like all other resource references in the same file. Breaks if deployed under a different base path.
**Fix:**
1. Change line 46 from:
   ```html
   <script is:inline src="/cherrypicker/scripts/layout.js"></script>
   ```
   to use the base variable:
   ```html
   <script is:inline src={`${base}scripts/layout.js`}></script>
   ```
   Note: Astro's `is:inline` scripts with dynamic `src` may not be supported. If not, an alternative is to inject the base URL via a `<meta>` tag and read it from `layout.js`.

**Verification:** Build the app and confirm layout.js loads correctly in both development and production builds.

---

## Deferred Findings (from this cycle, not to be implemented)

None -- all findings from this cycle are scheduled above.

## Prior-cycle deferred findings (carried forward, no changes)

See `.context/plans/00-deferred-items.md` for the full list of carried-forward deferred items. No changes to deferral status this cycle.
