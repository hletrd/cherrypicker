# Cycle 3 Code Review — Code Quality & Maintainability

**Reviewer:** code-reviewer
**Date:** 2026-05-05
**Scope:** apps/web/src/lib/parser/*, apps/web/src/components/upload/FileDropzone.svelte

---

## Findings

### F1: Unused imports and types in web parser files (High Confidence)

**Files:**
- `apps/web/src/lib/parser/pdf.ts:4` — `normalizeHeader` imported but never used (TS6133)
- `apps/web/src/lib/parser/pdf.ts:13` — `HEADER_KEYWORDS` imported but never used (TS6133)
- `apps/web/src/lib/parser/pdf.ts:22` — `PdfTextItem` type declared but never referenced (TS6196)
- `apps/web/src/lib/parser/xlsx.ts:5` — `normalizeHeader` imported but never used (TS6133)

**Problem:** These dead imports create noise in the build output and mislead readers about actual dependencies. The `PdfTextItem` type (line 22) is documented as "Minimal representation of pdfjs-dist TextContent.items members" but the code uses `'str' in item` runtime checks instead of TypeScript narrowing with this type.

**Fix:** Remove `normalizeHeader`, `HEADER_KEYWORDS`, and `PdfTextItem`. If `PdfTextItem` is needed for documentation purposes, add a `@typedef` comment instead of a declared type.

**Confidence:** High

---

### F2: normalizeHTML function duplicated across html.ts and xlsx.ts (High Confidence)

**Files:**
- `apps/web/src/lib/parser/html.ts:26-28`
- `apps/web/src/lib/parser/xlsx.ts:377-379`

**Problem:** Identical function body:
```ts
function normalizeHTML(html: string): string {
  return html.replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>');
}
```

This violates DRY. Any fix to the normalization logic (e.g., adding more tags) must be applied in two places.

**Fix:** Extract to a shared utility module or import from one file to the other. Since `html.ts` already exports `parseHTML`, the simplest fix is to export `normalizeHTML` from `html.ts` and import it in `xlsx.ts`.

**Confidence:** High

---

### F3: FileDropzone.svelte accept attribute mismatch with supported formats (High Confidence)

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Problem:** The `ACCEPTED_EXTENSIONS` array (line 106) includes `.json`, `.ofx`, `.qfx`, `.html`, `.htm`, but the two `<input type="file">` elements at lines 487 and 506 have:
```svelte
accept=".csv,.xlsx,.xls,.pdf"
```

This means users cannot select JSON, OFX, QFX, or HTML files through the native file picker, even though `isValidFile()` would accept them and the parsers support them. The file picker filter simply hides those files.

**Fix:** Update both `accept` attributes to match `ACCEPTED_EXTENSIONS`:
```svelte
accept=".csv,.xlsx,.xls,.pdf,.json,.ofx,.qfx,.html,.htm"
```

**Confidence:** High

---

### F4: fileIconName incomplete for supported file types (Medium Confidence)

**File:** `apps/web/src/components/upload/FileDropzone.svelte:139-144`

**Problem:** `fileIconName()` only returns icons for `.pdf`, `.xlsx`, and `.xls`. Files with `.json`, `.ofx`, `.qfx`, `.html`, `.htm` extensions fall through to the default `'document-text'` icon, which is acceptable but inconsistent with the explicit mapping pattern.

**Fix:** Add explicit mappings for the new formats or document the intentional fallback.

**Confidence:** Medium

---

### F5: Potential memory leak in pdf.ts text extraction (Low Confidence)

**File:** `apps/web/src/lib/parser/pdf.ts:496-546`

**Problem:** The PDF text extraction loop creates page objects via `doc.getPage(i)` but never calls `page.cleanup()` or destroys them. pdfjs-dist page objects hold references to the document and can accumulate memory when processing large PDFs with many pages.

**Fix:** Call `page.cleanup()` after extracting text from each page, or use `doc.getPage(i).then(page => { ... page.cleanup(); })`.

**Confidence:** Low — needs verification with pdfjs-dist API docs

---

## Final Sweep

All recently modified files in `apps/web/src/lib/parser/` and `apps/web/src/components/upload/` were examined. No additional critical issues found. The codebase shows good defensive programming patterns (forward-fill, error reporting, fallback parsing).
