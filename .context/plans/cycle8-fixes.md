# Cycle 8 Implementation Plan

**Date:** 2026-05-06
**Source reviews:** `.context/reviews/cycle8-*.md`, `.context/reviews/_aggregate.md`
**Status:** COMPLETED

---

## Tasks

### Task 1: Fix web-side PDF parser Math.abs parity [C8-01] ✅ DONE

- **Severity:** HIGH
- **Confidence:** High
- **Files:** `apps/web/src/lib/parser/pdf.ts:430-437`, `:614-621`
- **Description:** Web-side PDF parser converts ALL non-zero amounts (including refunds) to positive via `Math.abs()`. Server-side skips negative amounts with `if (amount <= 0) continue;`. Same file produces different results on web vs server.
- **Fix:**
  1. At line ~430: Replace `amount: Math.abs(amount)` with `amount` and add `if (amount <= 0) continue;` before transaction creation
  2. At line ~614-621 (fallback path): Replace `amount: Math.abs(amount)` with `amount` and add `if (amount <= 0) continue;`
  3. Remove false parity comments at lines 614-616
- **Verification:** Parse PDF with refund row (-50000). Web-side must skip it (0 transactions), matching server-side behavior.

### Task 2: Fix web-side XLSX parser Math.abs parity [C8-01] ✅ DONE

- **Severity:** HIGH
- **Confidence:** High
- **Files:** `apps/web/src/lib/parser/xlsx.ts:630-633`
- **Description:** Web-side XLSX parser does `amount: Math.abs(amount)` after parsing. Server-side XLSX parser uses `if (amount <= 0) continue;`.
- **Fix:**
  1. Replace `amount: Math.abs(amount)` with `amount`
  2. Add `if (amount <= 0) continue;` before transaction creation, matching server-side at `packages/parser/src/xlsx/index.ts:409`
- **Verification:** Parse XLSX with negative amount cell. Non-positive amounts should be skipped.

### Task 3: Fix web-side CSV parser Math.abs parity [C8-01] ✅ DONE

- **Severity:** HIGH
- **Confidence:** High
- **Files:** `apps/web/src/lib/parser/csv.ts:427-432`, `:544-552`
- **Description:** Web-side CSV parser applies `amount = Math.abs(amount)` in both the header-detected path (line 432) and the generic path (line 552). Server-side CSV adapters skip negative amounts.
- **Fix:**
  1. At line ~432 (header-detected path): Remove `amount = Math.abs(amount)`; add `if (amount <= 0) continue;` before transaction creation
  2. At line ~552 (generic path): Remove `amount = Math.abs(amount)`; add `if (amount <= 0) continue;`
  3. Remove false parity comment at lines 430-431
- **Verification:** Parse CSV with negative amount. Non-positive amounts should be skipped.

### Task 4: Cap SUMMARY_ROW_PATTERN input length [C8-02] ✅ DONE

- **Severity:** MEDIUM
- **Confidence:** Medium
- **Files:** `packages/parser/src/csv/column-matcher.ts:93` (used at `packages/parser/src/html/index.ts:156`, `packages/parser/src/xlsx/index.ts:379`, etc.)
- **Description:** `SUMMARY_ROW_PATTERN` is a large regex with 40+ alternations tested against unconstrained row text. Pathological input could cause regex engine slowdown (ReDoS).
- **Fix:**
  1. Cap row text length before regex test: `const cappedRowText = rowText.slice(0, 500);`
  2. Apply cap in all parser call sites (server HTML, XLSX, PDF, CSV; web HTML, XLSX, PDF, CSV)
- **Verification:** Parser tests pass; regex performance acceptable on long rows.

### Task 5: Fix build-json.ts exit code on validation errors [C8-03] ✅ DONE

- **Severity:** MEDIUM
- **Confidence:** High
- **Files:** `scripts/build-json.ts:278-283`
- **Description:** Script logs validation errors but exits 0. CI pipelines won't detect card rule failures.
- **Fix:**
  1. Add `process.exit(errors.length > 0 ? 1 : 0)` after the error report block
- **Verification:** Run script with an invalid YAML file; verify exit code is 1.

---

## Deferred Items

The following findings are deferred per repo rules. Security/correctness findings (C8-01, C8-02, C8-03) are scheduled above and NOT deferred.

### Deferred: Add parity test suite [C8-04]
- **Severity:** HIGH
- **Reason:** Requires significant test infrastructure — shared fixtures, cross-package test imports. Beyond scope of single fix cycle.
- **Exit criterion:** Create `packages/parser/__tests__/parity.test.ts` with fixtures for all 6 formats, asserting identical ParseResult from web and server parsers.

### Deferred: Harden esc() for DEL char [C8-05]
- **Severity:** LOW
- **Reason:** Defense-in-depth improvement. CSP mitigates XSS risk.
- **Exit criterion:** Add `\x7f` to control character strip regex in `esc()`.

### Deferred: Deduplicate build-json.ts Zod schemas [C8-06]
- **Severity:** LOW
- **Reason:** Code quality / maintainability. No runtime impact.
- **Exit criterion:** Import schemas from `@cherrypicker/rules` instead of redefining.

### Deferred: Add web-side parser-level tests [C8-07]
- **Severity:** MEDIUM
- **Reason:** Test coverage gap. Requires new test file creation and fixture setup.
- **Exit criterion:** Add `apps/web/__tests__/parser-formats.test.ts` with unit tests for each web-side parser format.

---

## Archive

The following Cycle 8 plan tasks are fully implemented and verified.

| Task | Commit | Status |
|------|--------|--------|
| C8-01: Web PDF/XLSX/CSV Math.abs parity | `274a3a4` | DONE |
| C8-02: SUMMARY_ROW_PATTERN ReDoS cap | `ca1ed4b` | DONE |
| C8-03: build-json.ts exit code | `4ebf2e5` | DONE |

The following Cycle 7 plan tasks are fully implemented and verified.

| Task | Commit | Status |
|------|--------|--------|
| C7-01: Web JSON Math.abs | `d8dcbc8` | DONE |
| C7-02: Web HTML Math.abs | `d8dcbc8` | DONE |
| C7-03: Web OFX timezone | `d8dcbc8` | DONE |
| C7-04: FALLBACK_CATEGORY_LABELS | `8104e95` | DONE |
| C7-05: esc() + CSP | `b57820e` | DONE |
| C7-06: JSON negative tests | pre-existing | DONE |
