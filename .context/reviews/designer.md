# Designer — cherrypicker (Cycle 5)

**Reviewer:** designer (sonnet)
**Scope:** UX, component API, visual consistency, interaction design
**Date:** 2026-05-05

---

## Summary

2 of 4 cycle-4 findings have been addressed. FileDropzone now accepts all supported formats (JSON, OFX, HTML, QFX in addition to CSV/XLSX/PDF). Error messages are still raw technical strings with no Korean localization. No loading state or transaction-level detail in results.

---

## Verification Results

### U-DES-01: FileDropzone rejects supported file types

**Status:** FIXED
**Evidence:** Commit `3d14c30` updated FileDropzone accept attributes and file icons for new formats. `ACCEPTED_EXTENSIONS` now includes all parser-supported formats.

---

### U-DES-02: Error messages are not user-friendly

**Status:** OPEN
**Evidence:** Error messages in `FileDropzone.svelte` are still raw strings:
- `CSV 헤더를 인식할 수 없습니다.`
- `거래 내역을 찾을 수 없습니다.`
- Raw exception messages from parse failures

No friendly error message map exists. Users see technical parser errors.

---

### U-DES-03: No loading state during analysis

**Status:** OPEN
**Evidence:** Large file parsing happens synchronously in the main thread. No progress bar, spinner, or stage labels. The UI appears frozen during parse.

---

### U-DES-04: Results display lacks transaction detail

**Status:** OPEN
**Evidence:** Results page shows category totals per card but no per-transaction assignment. Users cannot verify why a specific transaction was assigned to a specific card.

---

## New Findings (Cycle 5)

### [P2-MEDIUM] FileDropzone step indicator does not reflect parse progress

**File:** `apps/web/src/components/upload/FileDropzone.svelte`
**Confidence:** High

The component has a 4-step indicator (upload → detect → parse → analyze) but steps transition instantly with no actual progress tracking. Users see "파싱 중" then a long freeze.

**Fix:** Tie step transitions to actual async milestones, or add a determinate progress bar based on file size / row count.

---

### [P3-LOW] Bank detection UI gives no feedback on confidence

**File:** `apps/web/src/components/upload/FileDropzone.svelte`
**Confidence:** Medium

Bank auto-detection runs silently. If detection is wrong, the user only finds out after parse failure. No "detected as: {bank}" confirmation or override option.

**Fix:** Show detected bank name with a "not correct?" dropdown to override before parsing.

---

## Verdict

**FIX AND SHIP** — Localize error messages and add a loading spinner. These are small UX wins with high user impact.
