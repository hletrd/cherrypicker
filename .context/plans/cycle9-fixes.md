# Cycle 9 Implementation Plan

**Date:** 2026-05-06
**Source reviews:** `.context/reviews/cycle9-*.md`, `.context/reviews/_aggregate.md`
**Status:** IN PROGRESS

---

## Tasks

### Task 1: Fix server-side OFX memo deduplication check [C9-03] — PENDING

- **Severity:** LOW
- **Confidence:** High
- **Files:** `packages/parser/src/ofx/index.ts:189-191`
- **Description:** When `<NAME>` is empty, `tx.merchant` falls back to `<MEMO>`. The subsequent memo deduplication check uses `memo !== tx.memo` where `tx.memo` is `undefined`, so it's always true. This duplicates the merchant fallback value into `tx.memo`. The web-side correctly checks `memo !== tx.merchant`.
- **Fix:**
  1. Change `if (memo && memo !== tx.memo)` to `if (memo && memo !== tx.merchant)`
- **Verification:** Parse OFX with empty NAME but non-empty MEMO. `tx.merchant` should equal MEMO, `tx.memo` should NOT be set (since memo === merchant fallback).

---

### Task 2: Harden esc() against DEL and high-Unicode surrogates [C8-05] — PENDING

- **Severity:** MEDIUM
- **Confidence:** Medium
- **Files:** `packages/viz/src/report/generator.ts:31-41`
- **Description:** esc() strips `\x00-\x08\x0b\x0c\x0e-\x1f` but misses `\x7f` (DEL) and U+FFFE/U+FFFF (Unicode non-characters).
- **Fix:**
  1. Add `.replace(/\x7f/g, '')` after the control char strip
  2. Add `.replace(/￾|￿/g, '')` for Unicode non-characters
- **Verification:** esc() test with DEL and U+FFFE/U+FFFF inputs should strip them.

---

### Task 3: Fix web-side HTML parser amount import parity [C9-01] — PENDING

- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/parser/html.ts:10`, `apps/web/src/lib/parser/csv.ts`
- **Description:** Web-side HTML imports `parseCSVAmount` from `./csv.js` while server-side imports `parseAmountString` from `../csv/shared.js`. Functionally equivalent alias but creates divergence.
- **Fix:**
  1. Export `parseAmountString` as an alias from `apps/web/src/lib/parser/csv.ts`
  2. Change import in `html.ts` from `parseCSVAmount` to `parseAmountString`
- **Verification:** HTML parser tests pass; import resolves correctly.

---

### Task 4: Add missing `'description'` to web-side JSON MEMO_ALIASES [C9-02] — PENDING

- **Severity:** LOW
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/parser/json.ts:51-54`
- **Description:** Server-side JSON parser includes `'description' /* fallback */` in MEMO_ALIASES. Web-side does not.
- **Fix:**
  1. Add `'description' /* fallback */` to the MEMO_ALIASES array in web-side JSON parser
- **Verification:** Parse JSON with `{ "description": "memo text" }` and verify it maps to memo field.

---

## Deferred Items

The following findings are deferred per repo rules. They are recorded in `.context/plans/00-deferred-items.md` and updated below.

### Deferred: Server/web parser structural duplication [A-ARCH-01]
- **Severity:** HIGH
- **Reason:** Major architectural refactor requiring platform-agnostic shared module or codegen. Beyond scope of single fix cycle.
- **Exit criterion:** Create dedicated refactor cycle with design doc, then implement incrementally.

### Deferred: No parity test suite [C8-04]
- **Severity:** HIGH
- **Reason:** Requires significant test infrastructure — shared fixtures, cross-package imports.
- **Exit criterion:** `packages/parser/__tests__/parity.test.ts` with fixtures for all 6 formats.

### Deferred: isValidHeaderRow doesn't normalize headers [C6-01]
- **Severity:** HIGH
- **Reason:** Behavioral change affecting header detection across all parsers. Needs careful testing.
- **Exit criterion:** Apply `normalizeHeader()` before keyword checking; verify against real bank exports.

### Deferred: build-json.ts deduplicate Zod schemas [C8-06]
- **Severity:** MEDIUM
- **Reason:** Code quality. No runtime impact. Requires understanding schema export surface.
- **Exit criterion:** Import schemas from `@cherrypicker/rules` instead of inline definitions.

### Deferred: No web-side parser tests [C8-07]
- **Severity:** MEDIUM
- **Reason:** Test coverage gap. Requires new test infrastructure.
- **Exit criterion:** Add `apps/web/__tests__/parser-formats.test.ts`.

### Deferred: No tests for OFX CCSTMTRS [C9-TE-01]
- **Severity:** MEDIUM
- **Reason:** Test coverage gap.
- **Exit criterion:** Add OFX fixture with `<CCSTMTRS>` wrapper.

### Deferred: No tests for HTML forward-fill [C9-TE-02]
- **Severity:** MEDIUM
- **Reason:** Test coverage gap.
- **Exit criterion:** Add HTML fixture with merged cells.

---

## Archive

The following Cycle 8 plan tasks are fully implemented and verified.

| Task | Commit | Status |
|------|--------|--------|
| C8-01: Web PDF/XLSX/CSV Math.abs parity | `274a3a4` | DONE |
| C8-02: SUMMARY_ROW_PATTERN ReDoS cap | `ca1ed4b` | DONE |
| C8-03: build-json.ts exit code | `4ebf2e5` | DONE |
| C7-01..C7-06 | various | DONE |
