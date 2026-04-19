# Debugger / Latent Bug Review — Cycle 2 (2026-04-19)

Reviewer: debugger angle
Scope: Failure modes, edge cases, regressions, data consistency

---

## Finding C2-D01: `inferYear` heuristic can produce wrong year for December statements uploaded in early January

**File:** `apps/web/src/lib/parser/csv.ts:29-37`
**Severity:** HIGH
**Confidence:** High

The `inferYear` function checks if a date is more than 90 days in the future. Consider this scenario:
- Today is January 10, 2026
- The statement contains a transaction from December 15, 2025
- The CSV date is "12/15" (month/day format)
- `inferYear(12, 15)`: candidate = `new Date(2026, 11, 15)` = Dec 15, 2026
- Difference from now: ~339 days, which is > 90 days → returns 2025 ✓

This works correctly for the Dec → Jan case. But consider:
- Today is October 1, 2026
- The statement is from September 2026 (uploaded late)
- The CSV date is "09/15" (month/day format)
- `inferYear(9, 15)`: candidate = `new Date(2026, 8, 15)` = Sep 15, 2026
- Difference from now: ~-16 days (in the past) → returns 2026 ✓

This also works. The heuristic is sound for the stated purpose.

**However**, there's a subtle bug: the heuristic uses local time via `new Date()`, which means in rare timezone edge cases (UTC midnight crossing), the "now" value could differ from the user's actual date. For Korean users (UTC+9), this is never an issue since they're always ahead of UTC.

**Revised severity:** MEDIUM — the heuristic is correct for Korean timezone users; only a theoretical concern for other timezones.

---

## Finding C2-D02: PDF fallback parser uses `parseInt` without NaN check for amount

**File:** `apps/web/src/lib/parser/pdf.ts:287`
**Severity:** MEDIUM
**Confidence:** High

In the fallback parser's inner loop:
```ts
const amount = parseInt(amountMatch[1]!.replace(/,/g, ''), 10);
if (amount > 0) {
  fallbackTransactions.push({...});
}
```

`parseInt` can return `NaN` if the matched string contains unexpected characters. `NaN > 0` is `false`, so NaN amounts are silently skipped — which is safe but doesn't report the error to the user.

The structured parser (line 189-191) correctly uses `parseAmount()` which returns `NaN` and checks with `Number.isNaN()`. The fallback parser should do the same for consistency.

**Fix:** Use `parseAmount()` from the shared helper (already defined at line 145) and add `Number.isNaN` check.

---

## Finding C2-D03: `loadFromStorage` silently drops `fullStatementPeriod` and `totalTransactionCount`

**File:** `apps/web/src/lib/store.svelte.ts:130-139`
**Severity:** MEDIUM
**Confidence:** High

When loading from sessionStorage, the validation block creates a new object that includes `statementPeriod` and `transactionCount` but does NOT include `fullStatementPeriod` or `totalTransactionCount`:

```ts
return {
  success: Boolean(parsed.success),
  bank: ...,
  format: ...,
  statementPeriod: parsed.statementPeriod,
  transactionCount: ...,
  parseErrors: [],
  optimization: parsed.optimization,
  monthlyBreakdown: parsed.monthlyBreakdown,
} as AnalysisResult;
```

The `PersistedAnalysisResult` type (line 91-94) includes these fields in `persistToStorage`, and the getters (lines 195-198) have fallbacks, but the `loadFromStorage` function doesn't pass them through. The `as AnalysisResult` cast masks the missing fields.

**Fix:** Add `fullStatementPeriod` and `totalTransactionCount` to the returned object in `loadFromStorage`.

---

## Finding C2-D04: `toCoreCardRuleSets` spreads the entire rule object, potentially passing unknown fields

**File:** `apps/web/src/lib/analyzer.ts:42-63`
**Severity:** LOW
**Confidence:** Medium

The adapter uses `{ ...rule, card: { ...rule.card, source: ... } }` which passes through all fields from the web `CardRuleSet` to the core `CardRuleSet`. If the web type has extra fields not in the core type, TypeScript allows this (structural typing — extra properties are allowed when assigning). However, if the core package's code uses `Object.keys()` or `JSON.stringify()` on these objects, unexpected fields could cause subtle bugs.

Currently, the only extra field is `card.source` being `string` vs `'manual' | 'llm-scrape' | 'web'`, which the adapter correctly narrows. No actual bug exists, but the pattern is fragile.

---

## Finding C2-D05: `calculateRewards` global cap sync can undercount rule-level usage

**File:** `packages/core/src/calculator/reward.ts:260-264`
**Severity:** MEDIUM
**Confidence:** Medium

When a global cap is hit, the code adjusts `ruleMonthUsed` to reflect the actual applied amount:
```ts
const overcount = rewardAfterMonthlyCap - appliedReward;
ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed - overcount);
```

This prevents the rule-level cap from being over-consumed by the global cap, which is correct. However, there's a subtle issue: the `ruleResult.newMonthUsed` already includes the full reward (before global cap), so subtracting the overcount makes `ruleMonthUsed` reflect only the applied portion. For the next transaction under the same rule, `currentRuleMonthUsed` will be lower than expected, potentially allowing more reward through the rule-level cap than should be.

**Scenario:** If a rule has a monthly cap of 5000 Won, and the first transaction earns 4000 Won, but the global cap only allows 2000 Won of that:
- `ruleMonthUsed` is set to 4000 - 2000 = 2000
- Next transaction earns 2000 Won under the same rule
- `remaining = 5000 - 2000 = 3000`, so 2000 is allowed
- Total rule-level: 2000 + 2000 = 4000 (within cap) ✓
- But globally, only 2000 + 2000 = 4000 was applied, which may be correct or not depending on the global cap remaining

This is actually correct behavior — the rule-level cap should only count what was actually applied, not what was blocked by the global cap. The implementation is sound.

**Revised severity:** LOW — behavior is correct after deeper analysis.

---

## Finding C2-D06: `analyzeMultipleFiles` uses the same `previousMonthSpending` for all cards

**File:** `apps/web/src/lib/analyzer.ts:159-161`
**Severity:** MEDIUM
**Confidence:** Medium

The code computes a single `previousMonthSpending` value and applies it to all cards:
```ts
const cardPreviousSpending = new Map<string, number>(
  cardRules.map(r => [r.card.id, previousMonthSpending]),
);
```

But different cards have different `performanceExclusions`. A card that excludes "online_shopping" from its performance tier calculation should have a different effective previous-month spending than a card that doesn't exclude it. Currently, all cards get the same spending value (with a union of all exclusions applied).

The comment on line 148 acknowledges this is an approximation. The effect is that cards with more exclusions will appear to qualify for higher tiers than they should, potentially over-estimating their rewards.

**Fix:** Compute per-card qualifying spending based on each card's own exclusions. This was noted as a simplification in the plan but should be tracked for a follow-up.
