# Cycle 56 Aggregate Review

## Findings (4 actionable, 2 deferred)

### F1: "KRW" currency prefix not handled by amount parsers (FIX)
**Severity**: Medium - real format used by Korean bank exports
**Files**: 6 parseAmount implementations + 2 AMOUNT_PATTERNS arrays
**Impact**: Transactions with "KRW 10,000" amounts silently dropped
**Fix**: Add KRW prefix stripping + column detection pattern

### F2: XLSX parity test only checks column configs (FIX)
**Severity**: Low - test coverage gap
**File**: `packages/parser/__tests__/xlsx-parity.test.ts`
**Impact**: Pattern drift between server/web undetected
**Fix**: Expand parity tests to cover patterns and keywords

### F3: No test for numeric-only CSV headers (FIX)
**Severity**: Low - test coverage gap
**File**: `packages/parser/__tests__/csv.test.ts`
**Impact**: Guard behavior undocumented
**Fix**: Add test case

### F4: parseCSVAmount missing early return for empty string (FIX)
**Severity**: Very low - robustness
**File**: `packages/parser/src/csv/shared.ts`
**Impact**: Unnecessary processing on empty input
**Fix**: Add early return

### F5: Web-side hand-written adapters (DEFERRED - carried from C55-F3)
### F6: PDF multi-line header support (DEFERRED - carried from C55-F4)

## Tests Added
- KRW prefix tests across parsers
- Expanded XLSX parity tests
- Numeric-only header guard test
- Total: 847+ bun tests + 267+ vitest tests passing