# Cycle 11 — Critic Findings

**Date:** 2026-05-05
**Reviewer:** critic (simulated)
**Scope:** Multi-perspective critique of the whole change surface

## Summary

Cycle 10 fixes represent solid engineering: root-cause fix (Infinity), appropriate test coverage, and clean removal of defensive over-escaping. No new concerns from a product or user perspective.

---

## Findings

### C11-CT01 — [LOW] formatSavingsValue strips sign unconditionally

**File:** `apps/web/src/lib/formatters.ts:226`

`formatSavingsValue` strips the negative sign unconditionally. If the function is ever used in a context where negative savings are meaningful (e.g., showing loss), the sign will be silently discarded.

**Impact:** API footgun. The function name suggests it formats savings, which are typically positive, but the unconditional stripping is a hidden contract.

**Fix:** Rename to `formatSavingsValueAbsolute` or add a parameter to control sign stripping.

**Confidence:** Medium

---

### C11-CT02 — [LOW] "corrupted" label for quota errors is misleading

**File:** `apps/web/src/lib/store.svelte.ts:185`

`persistToStorage` returns `{ kind: 'corrupted' }` for `QuotaExceededError`. The data is not corrupted — the storage is full. This misleads debugging and user-facing messages.

**Impact:** Developer confusion when investigating persistence issues.

**Fix:** Return `{ kind: 'quota_exceeded' }` instead.

**Confidence:** High

---

### C11-CT03 — [LOW] Spinner animation without reduced-motion support

**File:** `apps/web/src/components/upload/FileDropzone.svelte:596-598`

The uploading spinner uses `animate-spin` with no `prefers-reduced-motion` alternative. Users with vestibular disorders may experience discomfort.

**Impact:** Accessibility gap, not functional.

**Fix:** Add CSS rule: `@media (prefers-reduced-motion: reduce) { .animate-spin { animation: none; } }`

**Confidence:** High

---

### C11-CT04 — [LOW] Step indicator relies on color alone for state

**File:** `apps/web/src/components/upload/FileDropzone.svelte:377-416`

The step indicator uses color (green for done, primary for active, gray for pending) without additional non-color cues. Users with color vision deficiency may have difficulty distinguishing states.

**Impact:** Minor. The step numbers and checkmark icons provide non-color information.

**Fix:** Already partially mitigated by checkmark icon and step numbers. No additional action needed.

---

## Verdict

**COMMENT** — Solid cycle. Fixes address real user pain points. Minor UX polish items remain.
