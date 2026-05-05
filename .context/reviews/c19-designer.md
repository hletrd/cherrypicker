# Designer Review — cherrypicker (Cycle 19)

**Reviewer:** designer
**Scope:** UI/UX, accessibility, responsive design, component behavior
**Date:** 2026-05-06

---

## Summary

Cycle 18 had minimal UI changes. Cycle 19 review finds the FileDropzone's step indicator lacks progress binding during actual analysis, and the file type acceptance list may reject valid OFX/HTML files in some browsers.

---

## New Findings

### C19-UI01 [LOW] — Step indicator shows "uploading" based on local state, not actual parser progress

**File:** `apps/web/src/components/upload/FileDropzone.svelte:88-93`
**Confidence:** Medium

```ts
let currentStep = $derived.by(() => {
  if (uploadStatus === 'success') return 4;
  if (uploadStatus === 'uploading') return 3;
  if (uploadedFiles.length > 0) return 2;
  return 1;
});
```

Step 3 ("분석 중") is shown immediately when the upload button is clicked, but the actual analysis involves file parsing, categorization, and optimization — which can take several seconds for large files. The step indicator shows "분석 중" for the entire duration without sub-progress, giving users no sense of how much work remains.

**Fix:** Consider exposing parser/optimizer progress events to the store, or add a time-based progress bar animation during step 3.

---

### C19-UI02 [LOW] — OFX/HTML file MIME type may fail browser detection

**File:** `apps/web/src/components/upload/FileDropzone.svelte:97-106`
**Confidence:** Medium

`ACCEPTED_TYPES` includes `'application/ofx'` and `'text/html'`, but browsers often report OFX files as `text/plain` or `application/octet-stream`, and HTML files from some systems as `application/xhtml+xml`. The extension fallback catches these, but only after the `file.type` check fails.

The current implementation is technically correct (extension fallback works), but the UX could be improved by checking extensions first for formats with unreliable MIME types.

**Fix:** No code change needed, but consider adding `application/xhtml+xml` to `ACCEPTED_TYPES`.

---

### C19-UI03 [LOW] — Error banner lacks focus management

**File:** `apps/web/src/components/upload/FileDropzone.svelte:611-632`
**Confidence:** Low

When `uploadStatus` becomes `'error'`, the error banner renders with `role="alert"`. However, focus is not moved to the banner, so screen reader users may not be notified immediately unless they are already reading the live region.

**Fix:** Add `aria-live="assertive"` to the error banner container, or move focus to the retry button on error.

---

## Carry-overs from Previous Cycles

- **U-DES-02** — Error messages not user-friendly (LOW)
- **U-DES-03** — No loading state during analysis (LOW, related to C19-UI01)

---

## Verdict

**SHIP IT** — C19-UI01 is a nice-to-have, not a blocker. The step indicator works correctly for its current purpose.
