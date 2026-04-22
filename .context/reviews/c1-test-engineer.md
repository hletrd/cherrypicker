# Test Engineer Review -- Cycle 1 (2026-04-22)

## Findings

### TE-01: No integration test for multi-file upload
- **File**: `apps/web/src/lib/analyzer.ts:264-384`
- **Problem**: `analyzeMultipleFiles` is the most complex function in the web app (120 lines, multiple async steps, month detection, transaction merging, previousMonthSpending calculation). There is no integration test for it.
- **Failure scenario**: A bug in the latest-month filtering logic or previousMonthSpending calculation goes undetected until a user reports incorrect optimization results after uploading multiple files.
- **Suggested fix**: Add integration tests covering: (1) single file upload, (2) multi-file same month, (3) multi-file different months, (4) month boundary detection, (5) previousMonthSpending with exclusions.
- **Confidence**: High (94+ cycles flagging this gap)

### TE-02: No test for SavingsComparison sign-prefix behavior
- **File**: `apps/web/src/components/dashboard/SavingsComparison.svelte`
- **Problem**: The sign-prefix logic has gone through multiple fix cycles (C82-C94) yet has no automated test. The logic involves animated values, threshold checks, and label/sign combinations.
- **Failure scenario**: A future refactor to formatSavingsValue breaks the threshold behavior, and no test catches it.
- **Suggested fix**: Add unit tests for `formatSavingsValue` (pure function, easily testable) covering: (1) value < 100 with positive prefixValue, (2) value >= 100 with positive prefixValue, (3) negative prefixValue, (4) zero, (5) animated intermediate values.
- **Confidence**: High (formatSavingsValue is a pure function with clear test cases)

### TE-03: No test for findRule specificity ordering
- **File**: `packages/core/src/calculator/reward.ts:63-88`
- **Problem**: `findRule` sorts candidates by specificity, but there is no test for the case where two rules have equal specificity. The sort is not stable, so the selected rule could vary across engines.
- **Failure scenario**: Two rules with the same category and no conditions but different rates are matched inconsistently.
- **Suggested fix**: Add test cases for: (1) rules with equal specificity, (2) wildcard rules vs specific rules, (3) subcategory rules vs broad rules.
- **Confidence**: Medium (logic is correct today but untested edge cases)

### TE-04: No test for global cap + rule cap interaction
- **File**: `packages/core/src/calculator/reward.ts:299-320`
- **Problem**: The global cap rollback logic (line 317) is the most complex part of the reward calculator, yet there is no targeted test for the interaction between global caps and rule-level caps.
- **Failure scenario**: A change to the rollback logic breaks the rule-level tracking, causing subsequent transactions to see incorrect remaining cap.
- **Suggested fix**: Add test cases for: (1) global cap clips a reward, verify rule-level tracker is rolled back, (2) multiple transactions where some hit the global cap and others don't, (3) global cap clips the last transaction of the month.
- **Confidence**: High (complex logic with no targeted test)

### TE-05: Existing tests may not cover reward-cap-rollback edge case
- **File**: `packages/core/__tests__/reward-cap-rollback.test.ts`
- **Problem**: The file exists but I couldn't verify its contents. The rollback logic at reward.ts:316-317 is subtle and may not have comprehensive coverage.
- **Suggested fix**: Verify the existing test covers: (1) global cap clip with rule cap remaining, (2) multiple rules sharing the same global cap, (3) zero reward after global cap is exhausted.
- **Confidence**: Medium (file exists, coverage unknown)

### TE-06: No test for detectBank confidence capping
- **File**: `packages/parser/src/detect.ts:141-143`
- **Problem**: The confidence capping for single-pattern banks has no dedicated test.
- **Failure scenario**: The capping logic is accidentally removed or the threshold is changed, allowing single-pattern banks to achieve 1.0 confidence on weak matches.
- **Suggested fix**: Add test verifying that banks with < 2 patterns have confidence <= 0.5.
- **Confidence**: Low (the logic is simple, but untested)

### TE-07: No test for sessionStorage persistence and recovery
- **File**: `apps/web/src/lib/store.svelte.ts:146-330`
- **Problem**: The sessionStorage persistence logic (versioning, migration, validation, truncation) has no automated test. This is some of the most complex state management in the app.
- **Failure scenario**: A schema change breaks the persistence/recovery logic, and users lose their analysis results on page refresh.
- **Suggested fix**: Add tests for: (1) persist and recover round-trip, (2) version mismatch handling, (3) truncation when data exceeds MAX_PERSIST_SIZE, (4) recovery from corrupted data.
- **Confidence**: High (complex untested state management)
