# Verifier Report — cherrypicker Correctness Verification

**Date**: 2026-04-22
**Scope**: Source files only across packages/core, packages/parser, packages/rules, packages/viz, apps/web
**Focus**: Do functions do what they claim? Are return types correct? Are edge cases handled? Do tests validate stated behavior?

---

## Verdict

**Status**: PASS
**Confidence**: high
**Blockers**: 0

## Evidence

| Check | Result | Command/Source | Output |
|-------|--------|----------------|--------|
| Tests | pass | `npx vitest run --reporter=verbose` | 8 test files, 189 tests passed, 0 failed |
| Types (core) | pass | `npx tsc -p packages/core/tsconfig.json --noEmit` | 0 errors |
| Types (parser) | pass | `npx tsc -p packages/parser/tsconfig.json --noEmit` | 0 errors |
| Types (rules) | pass | `npx tsc -p packages/rules/tsconfig.json --noEmit` | 0 errors |
| Types (viz) | pass | `npx tsc -p packages/viz/tsconfig.json --noEmit` | 0 errors |
| Types (web) | pass | `npx tsc -p apps/web/tsconfig.json --noEmit` | 0 errors |
| Build | N/A | No build step verified (TS-only packages, Astro app not built) | — |

---

## Findings

### F1: Duplicated cap logic between `calculatePercentageReward` and `applyMonthlyCap` in reward.ts

- **File+Line**: `packages/core/src/calculator/reward.ts:123-139` and `packages/core/src/calculator/types.ts:46-67`
- **Claimed behavior**: `calculatePercentageReward` in `types.ts` computes `floor(amount * rate)` and clamps by monthly cap. `applyMonthlyCap` in `reward.ts` independently implements the same cap-clamping logic.
- **Actual behavior**: Both functions implement identical cap logic (compare remaining, take min, track capReached). The `reward.ts` rate-based path calls `calcFn(effectiveAmount, normalizedRate, null, 0).reward` passing `null` for monthlyCap (bypassing the cap in `calculatePercentageReward`), then applies `applyMonthlyCap` separately. This is functionally correct but architecturally inconsistent — the cap parameter of `calculatePercentageReward` is always passed as `null` in actual use, making it dead code within the calculator pipeline.
- **Evidence**: Lines 272 and 277 of `reward.ts` pass `null` as the `monthlyCap` argument to `calcFn` (which is `calculatePercentageReward`), then call `applyMonthlyCap` on lines 273/278 to handle the cap. The `monthlyCap` parameter in `calculatePercentageReward` (types.ts:48) is never used in the actual calculation pipeline.
- **Suggested fix**: Either (a) pass `monthlyCap` directly to `calculatePercentageReward` and remove `applyMonthlyCap`, or (b) remove the `monthlyCap` parameter from `calculatePercentageReward` and document that it is a primitive that does not handle caps. Currently the code works correctly because `applyMonthlyCap` handles it, but a future developer could incorrectly pass a cap to `calculatePercentageReward` thinking it would be applied.
- **Confidence**: High

### F2: `selectTier` sets `tierId` to `'none'` when no tier matches — string sentinel value

- **File+Line**: `packages/core/src/calculator/reward.ts:184`
- **Claimed behavior**: When `selectTier` returns `undefined` (no qualifying tier), the code uses `tierId = 'none'` as a sentinel.
- **Actual behavior**: This sentinel is then used on line 223 to skip rule lookup (`tierId === 'none' ? undefined : findRule(...)`), producing 0 rewards. It also appears in the output as `performanceTier: 'none'` which is exposed to the UI. The string `'none'` is not part of the `PerformanceTier` type — it is a magic string.
- **Evidence**: Line 184: `const tierId = tier?.id ?? 'none';`. Line 223: `const rule = tierId === 'none' ? undefined : findRule(rewardRules, tx);`. No test asserts the exact value of `performanceTier` when no tier matches — the test at calculator.test.ts:147-155 checks `totalReward === 0` and `performanceTier === 'tier0'` (which IS a valid tier for mr-life, just one with no rewards). There is no test where `selectTier` returns `undefined`.
- **Suggested fix**: (a) Add a test case where `performanceTiers` has entries but none match `previousMonthSpending`, asserting `performanceTier === 'none'` and `totalReward === 0`. (b) Consider making this a proper type — `performanceTier: string | 'none'` in `CalculationOutput` — or using `undefined` instead of the magic string.
- **Confidence**: High

### F3: `findRule` subcategory blocking logic is not directly unit-tested for the `category === '*'` wildcard case

- **File+Line**: `packages/core/src/calculator/reward.ts:81`
- **Claimed behavior**: Line 81: `if (tx.subcategory && !rule.subcategory && rule.category !== '*') return false;` — broad category rules (no subcategory) should not match subcategorized transactions, EXCEPT wildcard rules (`category === '*'`).
- **Actual behavior**: The logic is correct per the code comment (lines 68-80). However, the test suite only tests the "broad dining blocked by cafe subcategory" case (calculator.test.ts:602-639). There is no test for the wildcard exception — i.e., that a `{ category: '*' }` rule DOES match a `tx.subcategory = 'cafe'` transaction. The `simple-plan` card's uncategorized rule uses `category: '*'` which implicitly tests this through the optimizer tests, but there is no explicit calculator-level test.
- **Evidence**: Grep for `findRule` in `*.test.ts` returns no matches. The calculator test at line 602 tests the blocking case but not the wildcard exception. The `simple-plan` card has `category: '*'` rules but the test at line 110 uses `category: 'uncategorized'` transactions (no subcategory), so the wildcard-exception path is not exercised.
- **Suggested fix**: Add a test with a `{ category: '*', rate: 1 }` rule and a `{ category: 'dining', subcategory: 'cafe' }` transaction, verifying the wildcard rule matches and produces reward.
- **Confidence**: Medium — the wildcard path is exercised at the integration level but not at the unit level

### F4: `ruleConditionsMatch` — `excludeOnline` and `minTransaction` conditions are not directly tested

- **File+Line**: `packages/core/src/calculator/reward.ts:36-51`
- **Claimed behavior**: `ruleConditionsMatch` checks `minTransaction`, `excludeOnline`, and `specificMerchants` conditions.
- **Actual behavior**: Only `specificMerchants` is tested (calculator.test.ts:689-700). The `excludeOnline` and `minTransaction` conditions have no test coverage. A bug in either condition (e.g., inverted logic, wrong comparison operator) would not be caught by the test suite.
- **Evidence**: Grep for `excludeOnline|minTransaction` in `*.test.ts` returns no matches. The conditions are simple (line 37: `tx.amount < rule.conditions.minTransaction`, line 40: `rule.conditions.excludeOnline && tx.isOnline`) but untested.
- **Suggested fix**: Add tests: (a) `minTransaction=50000` with a 30000 Won tx should produce 0 reward; (b) `excludeOnline=true` with `isOnline=true` tx should produce 0 reward.
- **Confidence**: Medium — logic is straightforward but zero test coverage

### F5: `calculateFixedReward` — `won_per_liter` unit returns `fixedAmount` without volume data, producing incorrect per-transaction values

- **File+Line**: `packages/core/src/calculator/reward.ts:161-166`
- **Claimed behavior**: Comment says "Transaction model doesn't carry fuel volume, so apply fixedAmount as a per-transaction discount — matches per-transaction display in Korean card apps for fuel discounts."
- **Actual behavior**: For a `won_per_liter` rule with `fixedAmount=60` (60 Won/liter), any fuel transaction regardless of amount returns exactly 60 Won. A 100,000 Won fuel purchase and a 5,000 Won fuel purchase both get 60 Won reward. This is acknowledged in the comment but produces misleading results. The test at calculator.test.ts:665-676 verifies this behavior (transportation reward = 60) so it is "correct by current design" but semantically wrong — the rate depends on fuel volume which is unavailable.
- **Evidence**: Line 162-166: `if (tierRate.unit === 'won_per_liter') { return fixedAmount; }`. Test at calculator.test.ts:673-676: `expect(transportation!.reward).toBe(60)`.
- **Suggested fix**: Document this limitation in the `CalculationOutput` type or `CategoryReward` interface (e.g., add `isApproximate?: boolean` flag). The current silent approximation can mislead users who see "60 Won reward" for a large fuel purchase and think the card is bad.
- **Confidence**: High — behavior is as-coded and tested, but semantically misleading

### F6: `inferYear` in both `packages/parser/src/date-utils.ts` and `apps/web/src/lib/parser/date-utils.ts` are code duplicates

- **File+Line**: `packages/parser/src/date-utils.ts:24-31` and `apps/web/src/lib/parser/date-utils.ts:35-43`
- **Claimed behavior**: Both files implement identical `inferYear` and `parseDateStringToISO` functions.
- **Actual behavior**: The two files are character-for-character identical in their `inferYear` and `parseDateStringToISO` implementations. The `apps/web` version adds `isValidISODate` and a `console.warn` for unparseable dates. Any future fix to the date parsing logic must be applied to both files, and divergence is a real risk.
- **Evidence**: Both files contain identical regex patterns, same `inferYear` 90-day lookback heuristic, same `isValidDayForMonth` helper. The `parseDateStringToISO` in the web version adds a `console.warn` at the end (line 140-141) that the parser version does not have.
- **Suggested fix**: Extract shared date utilities into `packages/parser/src/date-utils.ts` and have `apps/web` import from `@cherrypicker/parser`. The web-specific additions (`isValidISODate`, the `console.warn`) can be added as wrappers.
- **Confidence**: High

### F7: `formatWon` is duplicated 4 times across packages

- **File+Line**: `packages/viz/src/terminal/summary.ts:6-11`, `packages/viz/src/terminal/comparison.ts:4-9`, `packages/viz/src/report/generator.ts:10-15`, `apps/web/src/lib/formatters.ts:5-9`
- **Claimed behavior**: Each module has its own `formatWon` for formatting Won amounts.
- **Actual behavior**: Four independent implementations of the same function. Three (terminal/summary, terminal/comparison, report/generator) are identical. The `apps/web` version uses `amount.toLocaleString('ko-KR') + '원'` (same logic). Any future change (e.g., handling negative amounts differently) must be applied to all four.
- **Evidence**: Grep for `function formatWon` across the codebase returns 4 matches with identical implementations.
- **Suggested fix**: Extract to a shared utility in `packages/core` or a new `packages/format` package. Import from there.
- **Confidence**: High

### F8: `scoreCardsForTransaction` in greedy optimizer pushes/pops transactions in-place — fragile pattern

- **File+Line**: `packages/core/src/optimizer/greedy.ts:137-139`
- **Claimed behavior**: "Push transaction in-place instead of spreading a new array — avoids O(m*n) temporary array allocations."
- **Actual behavior**: The code pushes a transaction onto `currentTransactions`, calls `calculateCardOutput`, then pops it. This mutates the array stored in the `assignedTransactionsByCard` map. If `calculateCardOutput` were ever to throw an exception between the push and pop, the transaction would remain in the array, corrupting subsequent scoring. Currently safe because `calculateCardOutput` does not throw, but fragile.
- **Evidence**: Lines 137-139: `currentTransactions.push(transaction); const after = calculateCardOutput(...); currentTransactions.pop();`
- **Suggested fix**: Wrap in try/finally: `currentTransactions.push(transaction); try { const after = calculateCardOutput(...); ... } finally { currentTransactions.pop(); }`. Low risk since `calculateCardOutput` is pure, but defensive coding would prevent a future regression.
- **Confidence**: Medium

### F9: `loadAllCardRules` silently swallows load errors

- **File+Line**: `packages/rules/src/loader.ts:38-45`
- **Claimed behavior**: `loadAllCardRules` loads all card rules from a directory, skipping any that fail validation.
- **Actual behavior**: Failed loads are logged via `console.warn` but the function silently returns the subset that succeeded. A caller has no way to know how many rules failed or which ones. If a YAML file has a schema violation, it is silently dropped from the dataset.
- **Evidence**: Lines 38-45: `if (outcome.status === 'fulfilled') { results.push(outcome.value); } else { console.warn(...); }`. The test at schema.test.ts:250-253 only checks `rules.length > 650`, not that all files loaded.
- **Suggested fix**: Return both the loaded rules and the list of failures (e.g., `{ rules: CardRuleSet[], failures: { path: string; error: string }[] }`). This would make it possible to detect YAML regressions.
- **Confidence**: High

### F10: `getCalcFn` default case returns `calculateDiscount` for unknown reward types

- **File+Line**: `packages/core/src/calculator/reward.ts:97-111`
- **Claimed behavior**: `getCalcFn` dispatches to the correct calculator function based on reward type.
- **Actual behavior**: The `default` case returns `calculateDiscount` for any unknown type string. This means if a new reward type is added to the YAML schema (e.g., `voucher`) without updating `getCalcFn`, it will silently use discount math instead of erroring.
- **Evidence**: Lines 108-110: `default: return calculateDiscount;`. The Zod schema already validates reward types to the 4 known values (discount, points, cashback, mileage) at load time, so this default is currently unreachable in production. However, the `toCoreCardRuleSets` adapter in the web app falls back unknown types to `'discount'` (analyzer.ts:63), so a misconfigured card could reach this path.
- **Suggested fix**: Replace the `default` case with an explicit `throw new Error(`Unknown reward type: ${type}`)` or at minimum a `console.warn`. The Zod schema provides a safety net, but defense-in-depth is better.
- **Confidence**: Medium — unreachable via normal paths but the fallback is wrong in principle

### F11: `CATEGORY_NAMES_KO` in greedy.ts is a manually maintained duplicate of the YAML taxonomy

- **File+Line**: `packages/core/src/optimizer/greedy.ts:11-86`
- **Claimed behavior**: `CATEGORY_NAMES_KO` provides Korean labels for category IDs.
- **Actual behavior**: This is a hardcoded map that must be kept in sync with `packages/rules/data/categories.yaml` manually. The code already has a TODO at line 8 acknowledging this risk. If the taxonomy adds a new category, this map will be out of date, producing raw English IDs in the UI instead of Korean labels.
- **Evidence**: Line 8: "TODO(C64-03): CATEGORY_NAMES_KO can silently drift from the YAML taxonomy". The `categoryLabels` Map from the caller is used as the primary source (line 176), with `CATEGORY_NAMES_KO` as fallback. The web app passes `categoryLabels`, so the web path is safe. CLI/standalone usage relies on the fallback.
- **Suggested fix**: Import labels from the rules package at CLI startup instead of maintaining a duplicate map, as the TODO suggests.
- **Confidence**: High

### F12: `rewardTierRateSchema.refine` allows both `rate` and `fixedAmount` to be non-null if `rate === 0`

- **File+Line**: `packages/rules/src/schema.ts:21-24`
- **Claimed behavior**: The `.refine()` ensures `rate` and `fixedAmount` are mutually exclusive.
- **Actual behavior**: The refine condition is `!(tier.rate !== null && tier.rate > 0 && tier.fixedAmount !== null && tier.fixedAmount > 0)`. This allows both fields to be present if `rate === 0` or `fixedAmount === 0`, which would be a misconfiguration. However, the calculator code at reward.ts:258-269 handles the "both present" case with a warning, so this is not a functional bug — just a schema looseness.
- **Evidence**: Schema line 22: `!(tier.rate !== null && tier.rate > 0 && tier.fixedAmount !== null && tier.fixedAmount > 0)`. A tier with `rate: 0, fixedAmount: 100` would pass schema validation, then be treated as "has both" in the calculator.
- **Suggested fix**: Change the refine to `!(tier.rate !== null && tier.fixedAmount !== null)` or `!((tier.rate ?? 0) > 0 && (tier.fixedAmount ?? 0) > 0)` — current logic is equivalent but the `> 0` check makes the intent unclear.
- **Confidence**: Low — not a functional issue, just schema clarity

---

## Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Calculator functions return correct reward values for percentage-based rules | VERIFIED | calculator.test.ts: 100000 * 1% = 1000 (line 118); 150000 * 10% capped at 10000 (line 206); multiple cap accumulation (lines 586-599) |
| 2 | Monthly caps are enforced and rewards do not exceed cap | VERIFIED | calculator.test.ts:201-209 (single tx cap), 211-225 (multi-tx cap), reward-cap-rollback.test.ts (global cap interaction) |
| 3 | Global cap clips rewards and rolls back rule-level tracker correctly | VERIFIED | reward-cap-rollback.test.ts:66-79 (global cap clips), 94-107 (global tighter than rule cap rolls back), 131-177 (multi-category sharing) |
| 4 | Performance tier selection works correctly | VERIFIED | calculator.test.ts:170-196 (tier1/tier2/tier3 selection by previousMonthSpending) |
| 5 | Subcategory-specific rules take precedence over broad category rules | VERIFIED | calculator.test.ts:678-687 (cafe subcategory wins over dining), 602-639 (broad rule blocked by subcategorized tx) |
| 6 | Negative, zero, and non-KRW transactions are filtered | VERIFIED | calculator.test.ts:486-527 (negative, zero, non-KRW all skipped) |
| 7 | Optimizer assigns transactions to best card | VERIFIED | optimizer.test.ts:114-233 (single card, two cards, alternatives, savingsVsSingleCard) |
| 8 | Date parsing handles all Korean statement formats | VERIFIED | parser-date.test.ts: full year (lines 17-39), short year (42-77), MM/DD (79-89), Korean (91-104), edge cases (125-137), invalid ranges (139-245), leap year (247-320) |
| 9 | Bank detection identifies major Korean card issuers | VERIFIED | detect.test.ts:7-104 (KB, shinhan, samsung, hyundai, lotte, hana, nh, bc, ibk, woori, kakao, toss) |
| 10 | Zod schema validates and rejects invalid card rule data | VERIFIED | schema.test.ts:56-199 (valid data passes, missing fields rejected, invalid types rejected, negative values rejected) |
| 11 | All 650+ YAML card rule files load and validate | VERIFIED | schema.test.ts:251-276 (loads >650 rules, all have valid IDs, tiers, and rewards) |
| 12 | HTML report escapes XSS-unsafe merchant names | VERIFIED | report.test.ts:54-61 (`<이마트>` is escaped, not rendered as HTML) |

## Gaps

- **`excludeOnline` / `minTransaction` conditions untested** — Risk: medium — Suggestion: Add 2-3 tests covering each condition in calculator.test.ts
- **Wildcard rule + subcategorized transaction not unit-tested** — Risk: low (tested at integration level via optimizer) — Suggestion: Add explicit calculator-level test for `{ category: '*' }` rule matching a subcategorized tx
- **`selectTier` returning `undefined` (no qualifying tier) untested** — Risk: low — Suggestion: Add test with `performanceTiers` having `minSpending > 0` and `previousMonthSpending = 0`, asserting `performanceTier === 'none'`
- **`calculatePercentageReward` monthlyCap parameter is dead code in the pipeline** — Risk: low (correct behavior, architectural smell) — Suggestion: Remove the parameter or document that caps are applied separately
- **`won_per_liter` fuel rewards are silently approximate** — Risk: medium — Suggestion: Add `isApproximate` flag to output or at minimum document in UI
- **Date utility duplication between parser and web** — Risk: medium — Suggestion: Import from shared package

## Recommendation

APPROVE — The codebase is functionally correct: all 189 tests pass, all 5 package type checks are clean, and the core calculation logic (caps, tiers, subcategories, global caps) is well-tested with good edge case coverage. The 12 findings are primarily architectural concerns (duplicated code, untested condition branches, dead parameters) rather than correctness bugs. No finding represents a production-impacting defect. The 6 gaps identified above are test-coverage improvements that should be addressed in a follow-up pass but do not block approval.
