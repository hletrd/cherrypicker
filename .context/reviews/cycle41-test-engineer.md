# Test Engineering Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** test-engineer
**Cycle:** 41 / 100

---

## New Findings

### TE-41-01: No test for `parseAmountString` precision above MAX_SAFE_INTEGER (Medium)

**File:** `apps/web/__tests__/amount.test.ts:104-105`
**Confidence:** High

The existing test documents precision loss as expected behavior:
```typescript
expect(parseAmount('9,999,999,999,999,999')).toBe(9999999999999999);
```
Both the parsed result and the expected literal are silently rounded to `10000000000000000`. The test passes but tests incorrect behavior. There is no test verifying the precision boundary.

**Fix:** Add a test that documents the MAX_SAFE_INTEGER boundary and expected behavior (either error or capped value).

---

### TE-41-02: No tests for `parseOFXDate` timezone conversion (Medium)

**File:** `packages/parser/src/ofx/index.ts:88-115`
**Confidence:** High

The OFX date parser handles timezone offsets but has zero test coverage for:
- Time-only entries without timezone (most common Korean bank case)
- Cross-midnight timezone shifts
- Invalid timezone formats

**Fix:** Add unit tests for `parseOFXDate` covering these cases.

---

### TE-41-03: No tests for `analyzeMultipleFiles` batch error handling (Medium)

**File:** `apps/web/src/lib/analyzer.ts:315-317`
**Confidence:** Medium

When one file in a batch fails, all files fail. There are no tests verifying this behavior or testing mixed success/failure scenarios.

**Fix:** Add tests for batch uploads with one corrupt file.

---

### TE-41-04: No tests for `normalizeHTML` security patterns (Low)

**File:** `apps/web/src/lib/parser/html.ts:29-54`
**Confidence:** Medium

There are no tests verifying that `normalizeHTML` correctly strips script tags, event handlers, or iframe tags. This is a security-critical function with zero coverage.

**Fix:** Add unit tests for `normalizeHTML` covering each strip pattern.

---

## Carryover

| ID | Description | File | Severity |
|----|-------------|------|----------|
| TE-37-01 | No tests for OFX CCSTMTRS (credit card) parsing | `ofx/index.ts:29-31` | Medium |
| TE-37-02 | No tests for HTML forward-fill (web-side) | `html.ts` | Medium |
| TE-37-03 | No tests for JSON negative amount handling | `json/index.ts:138` | Medium |
| TE-37-04 | No parity tests for HTML/OFX/JSON | `packages/parser/` vs `apps/web/` | Medium |
| TE-40-01 | Parity tests only cover server-side parsers | `non-spending-parity.test.ts` | Low |
