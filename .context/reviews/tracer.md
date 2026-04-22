# Causal Trace Review: cherrypicker Data Flow

**Date:** 2026-04-22
**Scope:** Statement parsing -> categorization -> optimization output
**Method:** Evidence-driven causal tracing with competing hypotheses

---

## Trace Summary

The data flow through cherrypicker follows three stages: (1) statement parsing produces `RawTransaction[]`, (2) `MerchantMatcher` categorizes each transaction, (3) the greedy optimizer assigns transactions to cards and calculates rewards. Seven suspicious data-flow findings were identified, ranked by evidence strength and potential impact. Two findings are High confidence, three are Medium, and two are Low.

---

## Finding F1: Rate Normalization Assumption Not Enforced by Schema

**Confidence:** High
**File:** `/packages/core/src/calculator/reward.ts:113-121`
**Trace Path:** YAML `rate` field -> `normalizeRate()` -> `rate / 100` -> `calculatePercentageReward()` -> reward output

### Observation
`normalizeRate` at line 121 divides all rates by 100, assuming YAML values are in percentage form (1.5 = 1.5%). But the Zod schema at `/packages/rules/src/schema.ts:16` only validates `z.number().nonnegative().nullable()` -- no range check, no convention check.

### Hypotheses

| Rank | Hypothesis | Confidence | Evidence Strength |
|------|-----------|------------|-------------------|
| 1 | A YAML author will eventually write a pre-normalized rate (0.015 instead of 1.5), producing silently wrong near-zero rewards | High | Strong |
| 2 | All YAML authors consistently use percentage form, so this is theoretical | Low | Weak |

### Evidence For H1
- Schema allows any non-negative number, including values in 0-1 range
- No validation, no warning, no documentation in schema that enforces the convention
- The comment at line 115 says "All YAML rates are stored in percentage form" but this is a convention, not a constraint
- 81+ YAML files are maintained partially by LLM scraping (source: 'llm-scrape'), which may not respect undocumented conventions
- The result is silently wrong: a 1.5% rate stored as 0.015 becomes 0.015%, yielding ~100x undercount

### Evidence Against H1
- All 81 current YAML files use percentage form (per the comment)
- The scraper likely generates percentage-form values

### Suggested Fix
Add a Zod `.refine()` to `rewardTierRateSchema.rate` that rejects values in the 0-1 exclusive range (which are almost certainly pre-normalized):
```typescript
.refine(rate => rate === null || rate >= 1 || rate === 0, {
  message: 'Rate must be in percentage form (e.g., 1.5 for 1.5%). Values between 0 and 1 are likely pre-normalized.'
})
```

---

## Finding F2: loadAllCardRules Silently Drops Invalid YAML Files

**Confidence:** High
**File:** `/packages/rules/src/loader.ts:34-46`
**Trace Path:** YAML file -> `loadCardRule()` -> `Promise.allSettled()` -> `console.warn` -> optimizer runs with incomplete card set

### Observation
`loadAllCardRules` uses `Promise.allSettled` and only logs a `console.warn` for failures (line 42). Invalid YAML files are silently excluded from the returned array.

### Hypotheses

| Rank | Hypothesis | Confidence | Evidence Strength |
|------|-----------|------------|-------------------|
| 1 | A malformed YAML file will silently disappear from optimization, producing wrong "optimal" card assignments without any user-visible error | High | Strong |
| 2 | Zod validation catches all issues before they reach production | Low | Weak |

### Evidence For H1
- `console.warn` is invisible to web app users; in CLI mode, it's easy to miss in verbose output
- The optimizer proceeds normally with the subset of cards that loaded successfully
- A single malformed file could remove the user's best card from consideration
- No summary count ("loaded 80 of 81 cards") is reported anywhere
- The `settled` loop at lines 37-45 does not accumulate failure details for the caller

### Evidence Against H1
- Zod validation catches schema violations before they become runtime errors
- YAML files are validated in CI tests (`packages/rules/__tests__/schema.test.ts`)

### Rebuttal
CI tests validate the committed YAML files, but they cannot catch runtime issues like file-system permission errors, encoding problems, or changes made outside the repo. The `loadCardRule` function can also throw on any `readFile` error, not just schema violations.

### Suggested Fix
Return a result object that includes both the loaded rules and any failures:
```typescript
interface LoadResult {
  rules: CardRuleSet[];
  failures: Array<{ filePath: string; error: string }>;
}
```
Propagate `failures` to the CLI/web so the user sees "2 of 83 card rules failed to load" instead of silent exclusion.

---

## Finding F3: previousMonthSpending Self-Reference for Single-Month Uploads

**Confidence:** Medium
**File:** `/apps/web/src/lib/analyzer.ts:218-234`
**Trace Path:** Single file upload -> no previous month -> `analyzeMultipleFiles` line 333 -> `options?.previousMonthSpending` undefined -> `optimizeFromTransactions` line 218 -> `qualifying` computed from current transactions -> performance tier selection

### Observation
When only one month is uploaded and the user does not explicitly provide `previousMonthSpending`, the web app computes per-card "previous month spending" from the CURRENT month's transactions (lines 225-233). This self-referential value is then used to determine which performance tier the user qualifies for, directly affecting reward rates.

### Hypotheses

| Rank | Hypothesis | Confidence | Evidence Strength |
|------|-----------|------------|-------------------|
| 1 | Self-referencing current spending as "previous month" inflates/deflates performance tiers, producing reward estimates that don't match what the card company would actually give | Medium | Moderate |
| 2 | The self-reference is the best available approximation and produces reasonably accurate results | Medium | Moderate |

### Evidence For H1
- If current month spending is 500K Won, the optimizer assumes previous month was also 500K, qualifying for higher tiers
- If actual previous month was 200K (below tier threshold), the optimizer over-states rewards
- The user has no indication that the performance tier is based on estimated data
- This affects ALL reward calculations since performance tier determines which `RewardTierRate` applies

### Evidence For H2
- No historical data is available, so any estimate is speculative
- Using current spending is a reasonable proxy for ongoing spending patterns
- The alternative (assuming 0) would under-state rewards for most users

### Critical Unknown
What percentage of single-month uploads have significantly different previous-month spending? Without real-world data, the error magnitude is unknown.

### Suggested Fix
Show a visible disclaimer when `previousMonthSpending` is auto-estimated: "Performance tier based on current month's spending. Enter your actual previous month spending for accurate results." (The UI already supports manual input via `previousMonthSpendingOption`.)

---

## Finding F4: Zero-Reward Silent Failure When No Performance Tier Matches

**Confidence:** Medium
**File:** `/packages/core/src/calculator/reward.ts:190-199` and `/packages/core/src/calculator/reward.ts:223`
**Trace Path:** `selectTier` returns undefined -> `tierId = 'none'` -> line 223: `rule = undefined` -> all rewards = 0 -> optimization result shows 0 total reward with no explanation

### Observation
When a card has performance tiers but none match the user's spending level, `tierId` becomes `'none'` (line 184), and `findRule` is bypassed entirely (line 223: `tierId === 'none' ? undefined : findRule(...)`). All rewards for that card become 0. The only indication is a `console.warn` at line 196, which is invisible to web app users.

### Hypotheses

| Rank | Hypothesis | Confidence | Evidence Strength |
|------|-----------|------------|-------------------|
| 1 | Users in the web app will see cards with 0 rewards and not understand why, especially for CLI usage where previousMonthSpending defaults to 0 | Medium | Moderate |
| 2 | The console.warn is sufficient and most users provide previousMonthSpending | Low | Weak |

### Evidence For H1
- CLI defaults `previousMonthSpending` to 0, making this the default experience
- Many Korean credit cards have minimum spending thresholds (300K-500K Won)
- A user with 0 previousMonthSpending would see ALL cards showing 0 rewards
- The warning text is only in `console.warn`, not propagated to the result object
- The `CalculationOutput` has no field indicating "no tier matched"

### Suggested Fix
Add a `tierWarning` field to `CalculationOutput` and propagate it through to the web UI:
```typescript
interface CalculationOutput {
  // ... existing fields
  tierWarning?: string;  // "No performance tier matched for card X with spending Y"
}
```

---

## Finding F5: CATEGORY_NAMES_KO Hard-Coded Drift Risk

**Confidence:** Medium
**File:** `/packages/core/src/optimizer/greedy.ts:7-86`
**Trace Path:** New category added to `categories.yaml` -> no corresponding entry in CATEGORY_NAMES_KO -> CLI displays raw English ID (e.g., "telecom") instead of Korean label

### Observation
`CATEGORY_NAMES_KO` is a hard-coded map that duplicates category labels from the YAML taxonomy. The code already has a TODO at lines 7-10 acknowledging this drift risk (C64-03). No automated check ensures the map stays in sync with the YAML.

### Evidence
- The TODO explicitly warns about this
- New categories are added to YAML by card rule authors/scraper
- The fallback is `categoryKey` (English ID), which is displayed to Korean users
- This affects CLI/standalone usage only (web app uses `categoryLabels` Map from API)

### Suggested Fix
Import labels from the rules package at CLI startup, or add a CI check that compares `CATEGORY_NAMES_KO` keys against `categories.yaml` IDs.

---

## Finding F6: Greedy Optimizer Push/Pop Exception Fragility

**Confidence:** Low-Medium
**File:** `/packages/core/src/optimizer/greedy.ts:129-139`
**Trace Path:** `scoreCardsForTransaction` -> `currentTransactions.push(transaction)` -> `calculateCardOutput()` -> if exception -> `pop()` skipped -> array corrupted

### Observation
The `scoreCardsForTransaction` function uses an in-place push/pop pattern on the shared `assignedTransactionsByCard` arrays. If `calculateCardOutput` throws between push and pop, the transaction remains in the array, corrupting all subsequent scoring.

### Hypotheses

| Rank | Hypothesis | Confidence | Evidence Strength |
|------|-----------|------------|-------------------|
| 1 | Under current code, this is safe (synchronous, no throw path), but fragile against future changes | Low-Medium | Moderate |
| 2 | This could cause data corruption today under specific edge cases | Low | Weak |

### Evidence For H1
- JavaScript is single-threaded; `calculateCardOutput` is synchronous
- `calculateRewards` is defensive: checks for null tierRate, handles missing rules
- No current code path throws between push and pop
- But: if anyone adds an assertion or validation that throws inside calculateRewards, this breaks silently
- The comment at line 136 acknowledges the pattern: "mutation is safe as long as we pop before the next iteration"

### Evidence For H2
- No current evidence of a throw path, but the pattern is a latent risk

### Suggested Fix
Wrap the push/measure/pop in a try/finally:
```typescript
currentTransactions.push(transaction);
try {
  const after = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
  const reward = Math.max(0, after - before);
  scores.push({ cardId: rule.card.id, cardName: getCardName(rule), reward, rate: transaction.amount > 0 ? reward / transaction.amount : 0 });
} finally {
  currentTransactions.pop();
}
```

---

## Finding F7: Web CardRuleSet Type Narrowing Silent Fallbacks

**Confidence:** Low-Medium
**File:** `/apps/web/src/lib/analyzer.ts:50-71`
**Trace Path:** `getAllCardRules()` -> `toCoreCardRuleSets()` -> unknown `source` silently becomes `'web'` -> unknown `type` silently becomes `'discount'` -> wrong reward calculation

### Observation
The `toCoreCardRuleSets` function narrows web-side `string` types to the core package's union types. Unknown values silently fall back to `'web'` (for source) or `'discount'` (for reward type). If the JSON data is corrupted or the schema changes, the fallback produces wrong results without any warning.

### Evidence
- Line 57: `source: VALID_SOURCES.has(rule.card.source) ? ... : 'web'` -- no warning for unknown source
- Line 62: `type: VALID_REWARD_TYPES.has(r.type) ? ... : 'discount'` -- no warning for unknown reward type
- The static JSON is validated at build time, but runtime corruption (stale cache, CDN issue) is not caught
- An unknown reward type becoming 'discount' could calculate rewards using the wrong formula
- The difference between discount, points, cashback, and mileage is cosmetic in the current implementation (all use `calculatePercentageReward`), so the actual reward amount would be correct even with the wrong type label

### Suggested Fix
Log a warning when fallbacks are triggered, and consider making the fallbacks fail loudly in development mode:
```typescript
source: VALID_SOURCES.has(rule.card.source)
  ? (rule.card.source as ...)
  : (console.warn(`[cherrypicker] Unknown card source: ${rule.card.source}`), 'web'),
```

---

## Aggregate Hypothesis Table

| Rank | Finding | Confidence | Impact | Trace Path |
|------|---------|------------|--------|------------|
| 1 | F1: Rate normalization not schema-enforced | High | Silent ~100x undercount | YAML rate -> normalizeRate -> reward output |
| 2 | F2: loadAllCardRules silently drops invalid YAML | High | Best card excluded from optimization | Malformed YAML -> Promise.allSettled -> console.warn -> incomplete card set |
| 3 | F3: previousMonthSpending self-reference | Medium | Inflated/deflated tier, wrong rewards | Single month -> auto-computed spending -> tier selection -> reward rates |
| 4 | F4: Zero-reward silent failure | Medium | User sees 0 rewards with no explanation | No tier match -> tierId='none' -> all rules bypassed -> 0 reward |
| 5 | F5: CATEGORY_NAMES_KO drift | Medium | CLI shows English IDs to Korean users | New YAML category -> no map entry -> raw key displayed |
| 6 | F6: Push/pop exception fragility | Low-Medium | Array corruption if calculateRewards throws | Exception in calculate -> pop skipped -> stale state |
| 7 | F7: Type narrowing silent fallbacks | Low-Medium | Wrong reward type label, correct amount | Unknown JSON type -> 'discount' fallback -> cosmetic label error |

---

## Convergence Notes

F3 and F4 converge on a shared root cause: the `previousMonthSpending` input to the optimizer is either missing (F3) or too low (F4), both leading to wrong performance tier selection. F3 addresses the estimation problem; F4 addresses the communication problem when the estimate fails. They are distinct findings (one is about wrong data, the other is about missing feedback) but share the causal chain through `selectTier`.

F1 and F7 are separate: F1 is a schema enforcement gap that affects the reward calculation directly; F7 is a type-narrowing gap that affects the reward type label. Both produce silent wrong results, but F1 has material financial impact while F7 is currently cosmetic (all reward types use the same calculation).

---

## Critical Unknown

What is the actual distribution of `previousMonthSpending` values in real usage? Findings F3 and F4 both depend on how often users provide explicit spending values versus relying on auto-estimation. Without telemetry or user research, the real-world error magnitude is unknown.

---

## Discriminating Probe

For F1 (the highest-confidence material finding): Create a test YAML card file with `rate: 0.015` (pre-normalized) instead of `rate: 1.5`. Run the optimizer and verify whether the reward output is ~100x lower than expected. This single probe would confirm or deny the entire F1 finding and determine whether a schema-level fix is urgent.

---

## Uncertainty Notes

- F6 (push/pop fragility) depends on whether `calculateRewards` can throw. Current analysis shows no throw path, but future changes could introduce one. The finding is provisionally Low-Medium confidence.
- F3 (self-reference) impact depends on how often single-month uploads occur and how much spending varies month-to-month. Without usage data, the error magnitude is unknown.
- F7 (type narrowing) is Low-Medium because all reward types currently share the same calculation. If mileage or fixed-amount rewards diverge in calculation logic in the future, this finding's impact would increase.
