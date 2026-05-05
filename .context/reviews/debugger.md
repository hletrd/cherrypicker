# Debugger — Cycle 4 Findings

## Summary
5 findings on error handling, edge cases, and failure modes. 2 critical, 2 high, 1 medium.

## Findings

### D-DEB-01 [CRITICAL] FileDropzone crashes on error due to ReferenceError
- **File**: `apps/web/src/components/upload/FileDropzone.svelte` lines 251, 314, 363
- **Issue**: Variable `errorMessages` declared but `errorMessage` referenced. Any error path throws `ReferenceError: errorMessage is not defined`, breaking the entire upload flow.
- **Reproduction**: Upload any non-matching file type or trigger parse error.
- **Fix**: Rename all `errorMessage` references to `errorMessages`.

### D-DEB-02 [CRITICAL] Non-null assertion in PDF fallback scanner
- **File**: `packages/parser/src/pdf/index.ts` line 361
- **Issue**: `(amountMatch[1] ?? ... ?? amountMatch[7])!` will throw if all groups are undefined. Happens when regex matches but captures nothing.
- **Reproduction**: PDF with malformed amount line (e.g., "금액: " with no number).
- **Fix**: Add explicit undefined check and throw descriptive error.

### D-DEB-03 [HIGH] OFX date parser corrupts timezone data
- **File**: `packages/parser/src/ofx/index.ts` lines 73-80
- **Issue**: `replace(/[^0-9].*$/, '')` strips timezone offset. "20240115120000[-5:EST]" becomes "20240115120000", shifting the date.
- **Reproduction**: Parse OFX with timezone-aware timestamps.
- **Fix**: Parse full string including timezone, convert to UTC.

### D-DEB-04 [HIGH] AbortController timeout not cleared on success path
- **File**: `packages/parser/src/pdf/llm-fallback.ts` lines 50-67
- **Issue**: Timeout is in `finally` block, which is correct. But the abort signal is passed to `client.messages.create`, and if the call succeeds quickly, the timeout still fires (harmless but leaks timer).
- **Fix**: Use `clearTimeout` in success path before `finally`, or use `AbortSignal.timeout()`.

### D-DEB-05 [MEDIUM] HTML forward-fill mutates array during iteration
- **File**: `packages/parser/src/html/index.ts` lines 137-215
- **Issue**: Forward-fill modifies `rows` in place while iterating. If a later row depends on an earlier row that gets filled, behavior depends on iteration order.
- **Fix**: Make forward-fill idempotent by using two-pass approach or cloning.

## Root Cause Analysis

### Why FileDropzone bug persists
- Component tests only cover happy path
- TypeScript cannot catch Svelte template variable names
- No e2e test exercises file rejection

### Why PDF scanner non-null assertion exists
- Regex was tested with well-formed data only
- No fuzz testing on parser inputs
- TypeScript `!` operator suppresses compile-time safety

## Recommendations
1. Add Svelte template linting (if available)
2. Fuzz-test all parsers with random/malformed inputs
3. Review all `!` non-null assertions in parser code
