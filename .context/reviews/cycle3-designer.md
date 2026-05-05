# Cycle 3 UI/UX Review — FileDropzone & Parser UX

**Reviewer:** designer
**Date:** 2026-05-05
**Scope:** apps/web/src/components/upload/FileDropzone.svelte

---

## Findings

### F1: File picker filter hides supported file types (High Confidence)

**File:** `apps/web/src/components/upload/FileDropzone.svelte:487,506`

**Problem:** The `<input accept=".csv,.xlsx,.xls,.pdf">` attribute on both file inputs restricts the OS file picker to only show CSV, Excel, and PDF files. However, the application now supports JSON, OFX/QFX, and HTML formats (as evidenced by `ACCEPTED_EXTENSIONS` and parser additions in cycles 97-98).

**Impact:** Users with JSON, OFX, QFX, or HTML statement files cannot select them through the file picker. They would need to rename files or use drag-and-drop (which bypasses the accept filter).

**Fix:** Update both `accept` attributes to include all supported extensions.

**Confidence:** High

---

### F2: No visual distinction for newly-supported file types (Medium Confidence)

**File:** `apps/web/src/components/upload/FileDropzone.svelte:139-144`

**Problem:** The `fileIconName` function does not provide specific icons for JSON, OFX/QFX, or HTML files. All non-PDF/non-Excel files get the generic `document-text` icon. While functional, this provides less visual feedback to users uploading newly-supported formats.

**Fix:** Add icon mappings or use a generic icon that better represents "document" for all text-based formats.

**Confidence:** Medium

---

### F3: Keyboard accessibility of drop zone (already addressed)

The drop zone has `role="button"`, `tabindex="0"`, and keyboard handlers for Enter/Space. This is correctly implemented per WCAG.

---

## Final Sweep

The FileDropzone component was thoroughly reviewed for accessibility, UX flow, and visual consistency. The step indicator, drag-and-drop, error handling, and success states are all well-implemented. The only significant issue is the file type filter mismatch.
