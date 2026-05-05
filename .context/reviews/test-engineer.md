# Test Engineer — Cycle 4 Findings

## Summary
6 findings. 2 critical test gaps, 2 high, 2 medium.

## Findings

### T-TE-01 [CRITICAL] Missing test for FileDropzone error path
- **File**: `apps/web/src/components/upload/FileDropzone.svelte`
- **Issue**: `errorMessage` vs `errorMessages` ReferenceError (C-CR-03) not caught by any existing test. The component test file only tests happy path.
- **Fix**: Add tests for: invalid file type, oversized file, parse failure, duplicate file.

### T-TE-02 [CRITICAL] No parser parity test suite
- **Files**: `packages/parser/src/` vs `apps/web/src/lib/parser/`
- **Issue**: Server and web parsers diverge silently. Cycle 2 found negative amount divergence; cycle 4 may find more.
- **Fix**: Create `__tests__/parity/` with fixtures run through both parser stacks.

### T-TE-03 [HIGH] Missing refund transaction test fixtures
- **Files**: All parser `__tests__/` directories
- **Issue**: No fixtures include negative amounts or refund rows. Parser behavior on refunds is untested.
- **Fix**: Add `refund.csv`, `refund.xlsx`, `refund.pdf.txt`, etc. to fixtures.

### T-TE-04 [HIGH] Optimizer has no performance regression tests
- **File**: `packages/core/src/optimizer/greedy.ts`
- **Issue**: O(n^2 log n) sort (P-PR-01) has no benchmark baseline. Performance could regress silently.
- **Fix**: Add `benchmark/greedy.bench.ts` with 10/50/100 card scenarios.

### T-TE-05 [MEDIUM] No integration test for full CLI pipeline
- **File**: `tools/cli/src/commands/optimize.ts`
- **Issue**: CLI entry point is untested. Argument parsing, file reading, and output formatting not exercised.
- **Fix**: Add `__tests__/cli.integration.test.ts` using temporary files.

### T-TE-06 [MEDIUM] No test for LLM fallback parsing
- **File**: `packages/parser/src/pdf/llm-fallback.ts`
- **Issue**: LLM-dependent code is untestable without API key. No mock-based unit tests.
- **Fix**: Inject Anthropic client as dependency for testability.

## Test Coverage Gaps
| Module | Lines | Covered | Gap |
|--------|-------|---------|-----|
| FileDropzone.svelte | ~400 | ~120 (happy path) | Error paths |
| Web parsers | ~800 | ~400 | Refunds, edge cases |
| Optimizer | ~200 | ~150 | Performance, large N |
| CLI | ~150 | ~0 | Entire module |
| LLM fallback | ~100 | ~0 | Entire module |

## Recommendations
1. Add error-path Svelte component tests with `@testing-library/svelte`
2. Create shared test fixtures in `packages/parser/__tests__/fixtures/`
3. Add benchmark suite to CI (run on PR, not blocking)
