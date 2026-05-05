# Cycle 3 (RPF Loop) — Implementation Plan

**Date:** 2026-05-05
**Source reviews:** `.context/reviews/cycle3-*.md`, `.context/reviews/cycle3-aggregate.md`
**Status:** Complete

---

## High Priority

### H1: Fix FileDropzone input accept attribute mismatch
- **Severity:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte`
- **Lines:** 487, 506
- **Description:** The `<input accept="...">` attributes on both file input elements only list `.csv,.xlsx,.xls,.pdf`, but `ACCEPTED_EXTENSIONS` (line 106) includes `.json`, `.ofx`, `.qfx`, `.html`, `.htm`. Users cannot select these newly-supported formats through the OS file picker.
- **Action:** Update both `accept` attributes to: `.csv,.xlsx,.xls,.pdf,.json,.ofx,.qfx,.html,.htm`
- **Status:** Completed

---

## Medium Priority

### M1: Remove unused imports/types from web parser files
- **Severity:** Medium
- **Files:**
  - `apps/web/src/lib/parser/pdf.ts` — remove `normalizeHeader` (import line 4)
  - `apps/web/src/lib/parser/pdf.ts` — remove `HEADER_KEYWORDS` (import line 13)
  - `apps/web/src/lib/parser/pdf.ts` — remove `PdfTextItem` type declaration (line 22)
  - `apps/web/src/lib/parser/xlsx.ts` — remove `normalizeHeader` (import line 5)
- **Description:** Four TS6133/TS6196 warnings during `astro check`. Dead code misleads readers about actual dependencies.
- **Action:** Remove the unused imports and type declaration.
- **Status:** Completed

### M2: Deduplicate normalizeHTML function
- **Severity:** Medium
- **Files:** `apps/web/src/lib/parser/html.ts:26-28`, `apps/web/src/lib/parser/xlsx.ts:377-379`
- **Description:** Identical `normalizeHTML` function in two modules. Any fix must be applied in two places.
- **Action:** Export `normalizeHTML` from `html.ts`, import and use in `xlsx.ts`, remove local definition from `xlsx.ts`.
- **Status:** Completed

### M3: Add file icon mappings for new formats
- **Severity:** Medium
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:139-144`
- **Description:** `fileIconName()` only handles `.pdf`, `.xlsx`, `.xls`. New formats (JSON, OFX, QFX, HTML) fall through to generic icon.
- **Action:** Add mappings for `.json` → 'code', `.ofx`/`.qfx` → 'bank', `.html`/`.htm` → 'browser' (or appropriate Icon names).
- **Status:** Completed

### M4: Reorganize imports in pdf.ts
- **Severity:** Medium
- **File:** `apps/web/src/lib/parser/pdf.ts:241`
- **Description:** Mid-file import block for `date-utils` breaks module convention.
- **Action:** Move the import to the top of the file with other imports.
- **Status:** Completed

---

## Deferred Items

| Finding | Severity | Reason for deferral | Exit criterion |
|---------|----------|---------------------|----------------|
| D1: Add web-side tests for JSON/HTML/OFX parsers | Medium | Requires new test fixtures and files. Not blocking — server-side tests exist. | When web-side parser coverage drops below 80% or a bug is found. |
| D2: pdfjs-dist page cleanup (potential memory leak) | Low | Needs verification with pdfjs-dist API docs. Theoretical concern. | If memory profiling shows accumulation during large PDF processing. |

---

## Implementation Order

1. M4 — Reorganize pdf.ts imports (cleanest to do first)
2. M1 — Remove unused imports
3. M2 — Deduplicate normalizeHTML
4. M3 — Add file icon mappings
5. H1 — Fix FileDropzone accept attributes
6. Run gates (lint, typecheck, test)
7. Commit each fix separately
