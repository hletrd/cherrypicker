# Test Engineer Review — Cycle 28

## C28-TEST01: No dedicated tests for web-side `parseAmount` in `amount.ts`
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/amount.ts` (no test file)

The `parseAmount` function was extracted to `apps/web/src/lib/parser/amount.ts` in C27-COR03. It handles full-width digits, Won signs, 마이너스 prefix, trailing minus, parenthesized negatives, KRW prefix, and comma separators. However, there is no dedicated test file for this function. Edge cases like:
- Full-width digits `１，２３４`
- Parenthesized negatives `(1,234)`
- 마이너스 prefix `마이너스1,234`
- Trailing minus `1,234-`
- Empty string / whitespace-only input
- Invalid inputs that parse to NaN

are only tested indirectly through CSV parser tests. A dedicated test would ensure the extracted module works correctly in isolation and prevent regressions when the function is modified.

**Fix**: Create `apps/web/__tests__/amount.test.ts` with comprehensive tests for `parseAmount`.

## C28-TEST02: Server-side XLSX `parseAmount` wrapper has no direct test coverage
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts:151-164`

The local `parseAmount` wrapper in the server-side XLSX parser handles `number` inputs (rounding) and delegates `string` inputs to `parseAmountString`. There are no tests verifying:
- Number input rounding: `parseAmount(1234.56)` -> `1235`
- Non-finite number handling: `parseAmount(NaN)` -> `null`
- Non-string/non-number input: `parseAmount(null)` -> `null`

**Fix**: Add tests to `packages/parser/__tests__/xlsx.test.ts` or create a dedicated `amount.test.ts` on the server side.
