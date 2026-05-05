# Designer — cherrypicker (Cycle 18)

**Reviewer:** designer
**Scope:** UX, component API, visual consistency, interaction design, accessibility
**Date:** 2026-05-06

---

## Summary

FileDropzone now accepts all supported formats and has a beforeunload guard. Error messages are in Korean but remain technical parser strings. Loading state and transaction-level detail are still absent. The step indicator transitions instantly with no actual progress tracking.

---

## New Findings

### C18-UI01 [LOW] — FileDropzone step indicator lacks actual progress binding

**File:** `apps/web/src/components/upload/FileDropzone.svelte:88-93`
**Confidence:** High

```ts
let currentStep = $derived.by(() => {
  if (uploadStatus === 'success') return 4;
  if (uploadStatus === 'uploading') return 3;
  if (uploadedFiles.length > 0) return 2;
  return 1;
});
```

Step 3 ("분석 중") is set instantly when `uploadStatus` becomes `'uploading'`, but the actual parsing happens asynchronously inside `analysisStore.analyze()`. For large files, the UI shows "분석 중" for the entire duration with no sub-stage indication (parsing → categorizing → optimizing). Users cannot tell if the app is stuck.

**Fix:** Expose granular stages from `analysisStore` (e.g., `'parsing' | 'categorizing' | 'optimizing' | 'rendering'`) and bind the step indicator to actual milestones.

---

## Previously Reported — Status

| Finding | Status | Evidence |
|---------|--------|----------|
| U-DES-01: FileDropzone rejects formats | **FIXED** | All 8 formats in `ACCEPTED_EXTENSIONS` |
| U-DES-02: Error messages not friendly | **OPEN** | Raw parser errors still displayed without user-friendly mapping |
| U-DES-03: No loading state | **OPEN** | No progress bar, spinner, or stage labels during parse |
| U-DES-04: Results lack transaction detail | **OPEN** | No per-transaction assignment in results page |

---

## Verdict

**FIX AND SHIP** — Add granular stage tracking to `analysisStore.analyze()` and surface it in the step indicator. This is a small UX win with high perceived-performance impact.
