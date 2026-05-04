# Cycle 71 Test Engineer Review

## T71-01: Missing test for leading-plus amount column detection

The `isAmountLike()` function is the gatekeeper for data-inference column detection. No test verifies that leading-plus amounts like `+1,234` are recognized. Need tests for:
1. Server CSV generic parser with `+1,234` amounts in data-inference path
2. Web CSV generic parser with same

## No regressions in existing tests. 1270+ bun + 283+ vitest tests cover all major paths.