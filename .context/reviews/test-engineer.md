# Test Engineering Review — CherryPicker Cycle 37

**Reviewer:** test-engineer
**Scope:** Test coverage, edge cases, parity tests, missing test paths
**Date:** 2026-05-06

---

## Summary

Three new parsers added in C98/C99 (HTML table, OFX CCSTMTRS, JSON transaction) expand the test surface significantly. Coverage gaps exist for all three new formats, particularly for error paths and edge cases. Prior coverage gaps remain unaddressed.

| Category | Count | Severity |
|---|---|---|
| New Coverage Gaps | 5 | Medium |
| Carryover | 5 | — |

---

## NEW COVERAGE GAPS (Cycle 37)

### TE-37-01: No tests for OFX CCSTMTRS (credit card statement) parsing
**File:** `packages/parser/src/ofx/index.ts:29-31`, `apps/web/src/lib/parser/ofx.ts`
**Severity:** Medium | **Confidence:** High

The C99 commit added CCSTMTRS support for credit card OFX files. The `extractTransactionBlocks` function has SGML terminators for `CCSTMTRS` and `CREDITCARDMSGSRSV1`, but there are no test fixtures or tests exercising this path. A regression in the SGML pattern could break credit card OFX parsing silently.

**Fix:** Add test fixtures for credit card OFX files and tests covering both bank (STMTRS) and credit card (CCSTMTRS) paths.

---

### TE-37-02: No tests for HTML forward-fill logic
**File:** `packages/parser/src/html/index.ts:139-237`, `apps/web/src/lib/parser/html.ts:153-248`
**Severity:** Medium | **Confidence:** High

The forward-fill logic for merged cells in HTML tables (C99-02/C100-01) is complex: blank rows reset state, summary rows reset state, empty cells forward-fill from last non-empty value. No tests verify that a blank row correctly terminates forward-fill scope, or that summary row values don't leak into subsequent data rows.

**Fix:** Add tests with HTML tables containing merged cells, blank rows, and summary rows.

---

### TE-37-03: No tests for JSON negative amount handling
**File:** `packages/parser/src/json/index.ts:138`, `apps/web/src/lib/parser/json.ts:130`
**Severity:** Medium | **Confidence:** High

The JSON parser now skips negative amounts (refunds/credits) at line 138/130. There is no test verifying this behavior, and no test verifying that the `errors` array is populated when amounts are unparseable.

**Fix:** Add tests for: negative amount skip, zero amount skip, unparseable amount error, boolean amount error.

---

### TE-37-04: No parity tests for new parsers
**File:** `packages/parser/src/` vs `apps/web/src/lib/parser/`
**Severity:** Medium | **Confidence:** High

While existing parity tests cover CSV, XLSX, and PDF, there are NO parity tests for HTML, OFX, or JSON parsers. The code comments claim parity (e.g., "Parity with server-side packages/parser/src/html/index.ts (C98-02)"), but no automated verification exists.

**Fix:** Add `html-parity.test.ts`, `ofx-parity.test.ts`, `json-parity.test.ts` following the pattern of existing parity tests.

---

### TE-37-05: No tests for OFX timezone conversion
**File:** `packages/parser/src/ofx/index.ts:88-115`, `apps/web/src/lib/parser/ofx.ts:57-84`
**Severity:** Low | **Confidence:** Medium

`parseOFXDate` handles timezone offsets by converting to KST. Edge cases (cross-midnight offsets, negative offsets, no timezone) are not tested. A bug in timezone math could shift transaction dates by one day.

**Fix:** Add unit tests for `parseOFXDate` covering: no timezone, positive offset, negative offset, cross-midnight case.

---

## CARRYOVER (still open from prior cycles)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| TE-01 | Medium | `analyzer.ts` | No tests for `toCoreCardRuleSets` adapter |
| TE-02 | Medium | `analyzer.ts` | No tests for multi-file analyze |
| TE-03 | Low | `store.svelte.ts` | No tests for sessionStorage migrations |
| TE-04 | Medium | `html/index.ts` | No server-side HTML parser tests (now partially covered by web tests) |
| TE-05 | Low | `reward.ts` | No test for empty `performanceTiers` |

---

## Additional Coverage Gaps (Commonly Missed)

1. **OFX `ORG` tag bank detection** — No test for bank fallback via `<ORG>` tag
2. **HTML `normalizeHTML` XSS stripping** — No test verifying script tags are removed
3. **JSON wrapper key case-insensitive matching** — No test for `TRANSACTIONS` vs `transactions`
4. **JSON field alias priority** — No test verifying that `description` maps to merchant, not memo
5. **Error accumulation across multiple sheets** — HTML parser picks the sheet with most transactions; no test for multi-sheet HTML
