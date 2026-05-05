# Cycle 11 — Designer (UI/UX) Findings

**Date:** 2026-05-05
**Reviewer:** designer (simulated)
**Scope:** UI/UX review of web app components

## Summary

No new MEDIUM or HIGH UX issues. Cycle 10 aria-busy fix is correct. Two LOW accessibility polish items remain.

---

## Findings

### C11-UI01 — [LOW] Upload button aria-busy verified correct

**File:** `apps/web/src/components/upload/FileDropzone.svelte:588`

`aria-busy="true"` is set when `uploadStatus === 'uploading'`. The button is also `disabled` during upload. This is correct per WAI-ARIA — screen readers announce the busy state.

**Status:** VERIFIED FIXED (cycle 10)

---

### C11-UI02 — [LOW] Spinner lacks prefers-reduced-motion

**File:** `apps/web/src/components/upload/FileDropzone.svelte:596-598`

The upload spinner uses `animate-spin` with no reduced-motion alternative.

**Impact:** Users with vestibular disorders may experience discomfort from continuous rotation.

**Fix:** Add CSS: `@media (prefers-reduced-motion: reduce) { .animate-spin { animation: none; } }` or use a static loading icon.

**Confidence:** High

---

### C11-UI03 — [LOW] Step indicator color-only state

**File:** `apps/web/src/components/upload/FileDropzone.svelte:377-416`

Step states are distinguished by color (green/primary/gray). The checkmark icon and step numbers provide non-color information, so this is partially mitigated.

**Impact:** Minor. Users with deuteranopia may still perceive contrast differences.

---

### C11-UI04 — [LOW] Error banner uses list-disc with single items

**File:** `apps/web/src/components/upload/FileDropzone.svelte:619-623`

The error banner renders `<ul class="list-disc list-inside">` even when there is only one error message. A single-item bulleted list is slightly awkward UX.

**Impact:** Cosmetic.

**Fix:** Render `<p>` instead of `<ul>` when `errorMessages.length === 1`.

**Confidence:** Low

---

### C11-UI05 — [LOW] Dashboard cards lack region roles

**File:** `apps/web/src/components/dashboard/*.svelte`

Dashboard card components do not have `role="region"` or `aria-labelledby`. This was flagged in cycle 7 as D8-02.

**Impact:** Screen reader users navigate by landmark/region. Missing regions make spatial navigation harder.

**Fix:** Add `<section role="region" aria-labelledby="...">` to each dashboard card.

**Confidence:** Medium

---

## Verdict

**COMMENT** — Good accessibility posture. Two minor polish items.
