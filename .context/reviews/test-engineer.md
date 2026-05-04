# Test Engineer Review -- Cycle 16

## Test Coverage Gaps

### 1. Web-side CSV Normalized Header Detection (NEW)
Need tests verifying web-side bank adapters handle:
- Headers with parenthetical suffixes like "이용금액(원)"
- Headers with extra whitespace like "이용 일"
- Headers with zero-width spaces

These are currently untested because the web-side bank adapters have no dedicated test file (they're tested implicitly through the generic parser).

### 2. PDF detectHeaderRow Multi-Category Validation (NEEDS UPDATE)
Existing tests for `detectHeaderRow` don't test that summary-only rows are rejected. Need test with a row containing only amount keywords (e.g., `['이용금액', '거래금액']`) that should NOT be detected as a header.

### 3. Summary Row Skip with Spaced Patterns (NEW)
No test currently verifies that summary rows with spaced text like "총 합계" or "소 계" are properly skipped.

## Current Test Counts
- bun: 465 tests in parser package (719+ total including web)
- vitest: 231 tests
- Total passing: ~950+
