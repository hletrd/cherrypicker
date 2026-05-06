# Cycle 29 Test Engineering Review

## Findings

### HIGH-01: No tests for web-side amount.ts parseAmount edge cases
**File:** `apps/web/__tests__/amount.test.ts`
**Confidence:** High

The web-side amount tests (added in C28-04) cover basic cases but may miss edge cases:
- Full-width digits with mixed ASCII (e.g., `１2３4`)
- Multiple 마이너스 prefixes (e.g., `마이너스마이너스1,234`)
- Trailing minus combined with 원 suffix (e.g., `1,234원-`)
- Empty string after stripping 원 (e.g., `원` alone)
- Very large numbers that overflow JavaScript's safe integer range

The server-side `packages/parser/__tests__/amount.test.ts` has similar coverage.

**Fix:** Add test cases for edge cases. At minimum, test that `parseAmount('원')` returns `null` (not `0` or `NaN`), and test very large inputs like `parseAmount('9,999,999,999,999,999')`.

---

### HIGH-02: No tests for normalizeHTML javascript: URL stripping
**File:** `apps/web/__tests__/parser-html.test.ts` (added C28-05)
**Confidence:** High

The recently added test covers javascript: URL stripping in normalizeHTML, but only tests:
```ts
expect(normalizeHTML('<a href="javascript:alert(1)">')).not.toContain('javascript:');
```

Missing test cases:
- Single-quoted URLs: `href='javascript:alert(1)'`
- Unquoted URLs: `href=javascript:alert(1)`
- `src` attribute (not just `href`): `<img src="javascript:alert(1)">`
- Case variations: `JaVaScRiPt:alert(1)` (the regex uses `/i` flag, so should be tested)
- Mixed with other attributes: `<a href="javascript:alert(1)" onclick="foo()">`
- `javascript:` in non-href/src contexts (should NOT be stripped): `<div data-value="javascript:foo">`

**Fix:** Expand the test to cover these cases.

---

### MEDIUM-01: No tests for JSON parser wrapper key case-insensitivity
**Files:** `apps/web/src/lib/parser/json.ts`, `packages/parser/src/json/index.ts`
**Confidence:** Medium

The JSON parser supports case-insensitive wrapper key matching:
```ts
const lower = key.toLowerCase();
for (const objKey of Object.keys(obj)) {
  if (objKey.toLowerCase() === lower && Array.isArray(obj[objKey])) {
```

But there are no tests verifying this behavior works for keys like `"Transactions"` or `"DATA"`.

**Fix:** Add tests for case-insensitive wrapper detection.

---

### MEDIUM-02: Missing test for `findField` with duplicate aliases
**Files:** `apps/web/src/lib/parser/json.ts`, `packages/parser/src/json/index.ts`
**Confidence:** Medium

The `findField` function scans aliases in order. If a JSON object has both `date` and `transaction_date`, only `date` is returned. There's no test verifying this precedence behavior.

**Fix:** Add a test that verifies `findField({ date: '2024-01-01', transaction_date: '2024-02-01' }, DATE_ALIASES)` returns `'2024-01-01'`.

---

### LOW-01: No tests for XLSX forward-fill reset on summary rows
**File:** `packages/parser/__tests__/xlsx.test.ts`
**Confidence:** Low

Tests were added in C27-TEST01 for XLSX summary-row forward-fill reset, but web-side XLSX (`apps/web/src/lib/parser/xlsx.ts`) has the same logic with no corresponding test.

**Fix:** Add a web-side XLSX test for summary-row forward-fill reset parity.

---

### LOW-02: Calculator tests don't cover `won_per_liter` fixed reward
**File:** `packages/core/__tests__/calculator.test.ts`
**Confidence:** Low

The test added in C26-TEST02 covers combined rate+fixed rewards, but `won_per_liter` is explicitly handled in `calculateFixedReward` (lines 164-168) with no test coverage.

**Fix:** Add a test for fuel cards with `won_per_liter` unit.

---

## Summary

| Finding | Severity | Confidence | File |
|---------|----------|------------|------|
| HIGH-01 Missing amount edge case tests | High | High | amount.test.ts |
| HIGH-02 Missing normalizeHTML tests | High | High | parser-html.test.ts |
| MEDIUM-01 Missing JSON case-insensitive tests | Medium | Medium | json.test.ts |
| MEDIUM-02 Missing findField precedence tests | Medium | Medium | json.test.ts |
| LOW-01 Missing web-side XLSX forward-fill test | Low | Low | xlsx test |
| LOW-02 Missing won_per_liter test | Low | Low | calculator.test.ts |
