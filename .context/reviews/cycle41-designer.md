# Designer / UX Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** designer
**Cycle:** 41 / 100

---

## New Findings

### U-DES-41-01: Batch file upload provides no per-file error feedback (Medium)

**File:** `apps/web/src/lib/analyzer.ts:315-317`
**Confidence:** High

When uploading multiple files, if one file fails parsing, the entire batch fails with a generic message. The user cannot identify which file caused the problem.

**Fix:** Restructure to show per-file status: success, parsing error, or unsupported format.

---

### U-DES-41-02: Precision loss on large amounts is invisible to users (Low)

**File:** `packages/parser/src/csv/shared.ts:188-191`
**Confidence:** Medium

Amounts above ~9 quadrillion Won are silently rounded. No warning is shown. This affects corporate users but the failure mode is invisible.

**Fix:** Surface a parse error when amounts exceed `MAX_SAFE_INTEGER`.

---

## Carryover

| ID | Description | File | Severity |
|----|-------------|------|----------|
| U-DES-37-01 | No feedback when transactions are filtered out | All parsers | Medium |
| U-DES-40-01 | Calculator error message leaks implementation detail | `reward.ts:190-193` | Low |
