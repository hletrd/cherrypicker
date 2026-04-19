# Cycle 17 Comprehensive Review — 2026-04-19

**Reviewer:** Multi-angle comprehensive review
**Scope:** Full codebase, cross-file interactions, new findings not in D-01 through D-103

---

## Verification of Cycle 16 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C16-01 (cachedCoreRules ignores cardIds) | FIXED | `analyzer.ts:156-167` — cache stores full rules, filter applied after retrieval |
| C16-02 (categorySpending key mismatch) | MOOT | `constraints.ts` — `categorySpending` removed entirely (C16-03 fix) |
| C16-03 (categorySpending dead code) | FIXED | `constraints.ts` — `categorySpending` removed from interface and buildConstraints |
| C16-04 (categorySpending negative amounts) | FIXED | Same — dead code removed |
| C16-05 (findCategory O(n*m)) | DEFERRED | Same as D-09/D-100 — acceptable at current scale |
| C16-06 (stale fallback values) | FIXED | `index.astro:7-9` now shows 683/24/45 matching Layout.astro |
| C16-07 (animation flicker) | DEFERRED | Same as D-101 — acceptable, cleanup works correctly |
| C16-08 (buildCategoryKey not exported) | FIXED | `index.ts:18` re-exports `buildCategoryKey` |
| C16-09 (loose conditions typing) | FIXED | `cards.ts:6-12` now uses `WebRewardConditions` interface |

---

## New Findings

### C17-01: `parseAmount` returns NaN (not 0) for unparseable PDF amounts — downstream code may propagate NaN

**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/lib/parser/pdf.ts:180-183`

```ts
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  return Number.isNaN(n) ? NaN : n;
}
```

The function returns `NaN` for unparseable inputs. At line 232, the caller checks `Number.isNaN(amount)`, which correctly filters NaN amounts. However, the fallback parser at line 329 also checks `Number.isNaN(amount)`, so NaN is correctly caught in both paths.

The real issue is that `NaN` is returned instead of `0`. If any future caller of `parseAmount` forgets the NaN check, NaN will silently propagate into transaction amounts. The `isValidTx` validator in `store.svelte.ts:147` checks `Number.isFinite(tx.amount) && tx.amount > 0`, which would catch NaN at sessionStorage load time. But the optimizer's `greedyOptimize` at `greedy.ts:259-260` only filters `tx.amount > 0` — and `NaN > 0` is `false`, so NaN transactions would be silently dropped without error.

**Risk:** Currently safe due to multiple NaN guards, but the API contract of returning NaN instead of throwing or returning 0 is fragile. A new code path that forgets the NaN check will silently lose transactions.

**Suggested fix:** Return `0` instead of `NaN` (or throw), and let callers handle the zero case:

```ts
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}
```

---

### C17-02: `fallbackAmountPattern` uses `g` flag — `matchAll` on regex with global flag can produce unexpected results if reused

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/parser/pdf.ts:313`

```ts
const fallbackAmountPattern = /([\d,]+)원?/g;
```

The `g` flag on this regex is correct for `matchAll` usage, but the regex is declared inside the `parsePDF` function, so it's re-created on each call. If someone moves it to module level for performance, the `g` flag would cause `lastIndex` mutation issues with `.test()` or `.exec()`. This is the same class of issue as D-83 (BANK_SIGNATURES `g` flag risk), but the `g` flag is actually needed here for `matchAll`. The risk is only on refactoring.

**Suggested fix:** Add a comment noting that this regex must NOT be moved to module scope because the `g` flag is required for `matchAll` but would cause `lastIndex` issues with other methods.

---

### C17-03: `selectTier` returns `undefined` when no tier matches — `calculateRewards` uses `'none'` as tierId, which silently skips all reward rules

**Severity:** MEDIUM
**Confidence:** High
**File:** `packages/core/src/calculator/reward.ts:176-195`

```ts
const tier = selectTier(performanceTiers, previousMonthSpending);
const tierId = tier?.id ?? 'none';
// ...
const rule = tierId === 'none' ? undefined : findRule(rewardRules, tx);
```

When `previousMonthSpending` is 0 (no spending recorded) and there are no tiers with `minSpending: 0`, `selectTier` returns `undefined` and `tierId` becomes `'none'`. This causes ALL reward rules to be skipped — every transaction gets 0 reward.

This is technically correct (no tier = no rewards), but it creates a subtle failure mode: if a card has performance tiers but the minimum tier requires spending (e.g., minSpending: 300000), a user who didn't spend anything last month gets 0% on all categories even though they might expect some base rate.

The web app's default behavior compounds this: `analyzer.ts:173-184` sets `cardPreviousSpending` to the current month's spending when `previousMonthSpending` is not provided. But for cards with performance tiers, the "previous month" spending is what determines the tier, not the current month. For single-month uploads with no explicit previous month spending input, `previousMonthSpending` defaults to the current month's total — which IS the correct behavior per Korean card terms.

However, for the CLI/standalone path (not the web app), `previousMonthSpending` might default to 0, causing all tiered cards to return 0 reward.

**Concrete failure scenario:** User runs CLI with `previousMonthSpending: 0` on a card that requires 300K minimum — gets 0 reward on all categories with no warning.

**Suggested fix:** In `calculateRewards`, when `tierId === 'none'`, log a warning that no performance tier was matched. Or better, in `buildConstraints` / `analyzer.ts`, validate that `previousMonthSpending` is at least 0 (not undefined) and default to a reasonable value (e.g., 500000 per the FileDropzone placeholder text).

---

### C17-04: `TransactionReview.svelte` AI categorizer import is dead code — `aiCategorizer.isAvailable()` always returns false

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:6`

This is the same as D-10/D-68/D-81. The import is dead code. Not re-flagging as new, but noting it persists through 17 cycles.

---

### C17-05: `OptimalCardMap.svelte:19` uses `Math.max(...array)` spread — stack overflow risk

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:19`

Same as D-73/D-89. Not re-flagging. The spread is on `assignments.map((a) => a.rate)` which is bounded by the number of categories (< 50).

---

### C17-06: `SavingsComparison.svelte:74` divides by `bestSingleCard.totalReward` which can be 0

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:74`

```ts
const raw = opt.savingsVsSingleCard / opt.bestSingleCard.totalReward;
```

When `bestSingleCard.totalReward` is 0, `raw` becomes `NaN` or `Infinity`. The `Number.isFinite(raw)` check on line 75 handles this correctly, clamping to 0. Same as D-63. Not re-flagging.

---

### C17-07: `ilpOptimize` always warns and falls back to greedy — noisy console output in production

**Severity:** LOW
**Confidence:** High
**File:** `packages/core/src/optimizer/ilp.ts:48`

```ts
console.warn('[cherrypicker] ILP optimizer is not yet implemented — falling back to greedy optimizer');
```

Since `ilpOptimize` is exported from `index.ts` and available as an option, any code that calls it will get a console.warn on every invocation. The `optimize()` function defaults to greedy, so this warn only fires if someone explicitly selects ILP. However, the `optimize` function is not actually used by the web app (which calls `greedyOptimize` directly), so this warning is purely theoretical.

**Suggested fix:** Either remove the `ilpOptimize` export until implemented, or downgrade to `console.debug`. Having a public API that always warns is misleading.

---

### C17-08: `calculateRewards` bucket object created with `??` fallback — mutated before `set()` on first occurrence

**Severity:** LOW
**Confidence:** High
**File:** `packages/core/src/calculator/reward.ts:197-213`

```ts
const bucket =
  categoryRewards.get(categoryKey) ??
  {
    category: categoryKey,
    categoryNameKo: categoryKey,
    spending: 0,
    reward: 0,
    rate: 0,
    rewardType: rule?.type ?? 'none',
    capReached: false,
  };

bucket.spending += tx.amount;

if (!rule) {
  categoryRewards.set(categoryKey, bucket);
  continue;
}
```

When `categoryRewards.get(categoryKey)` returns `undefined`, a new bucket object is created via the `??` fallback. The bucket is then mutated (spending += tx.amount) BEFORE being set in the map. If the rule is not found, it's set on line 213. If the rule IS found, it's set on line 293 after reward calculation.

The issue: if `categoryRewards.get(categoryKey)` is called a SECOND time for the same categoryKey before the first bucket is `set()`, the `??` would create ANOTHER new object, losing the spending from the first transaction. This can't happen in the current code because `for (const tx of transactions)` is sequential and each categoryKey is set before the next transaction for that key is processed. However, this is fragile — if the loop were ever parallelized or if a `continue` path forgot to `set()`, spending would be silently lost.

Same class as D-87. Not a practical bug, but the pattern is fragile.

---

### C17-09: `buildAssignments` rate calculation uses `assignment.rate` for first entry but recalculates for accumulated entries — inconsistency

**Severity:** LOW
**Confidence:** Medium
**File:** `packages/core/src/optimizer/greedy.ts:158-166`

```ts
if (current) {
  current.spending += assignment.tx.amount;
  current.reward += assignment.reward;
  current.rate = current.spending > 0 ? current.reward / current.spending : 0;
} else {
  assignmentMap.set(key, {
    // ...
    rate: assignment.rate,
  });
}
```

For the first transaction in a category, `rate` is set to `assignment.rate` (the marginal rate from `scoreCardsForTransaction`). For subsequent transactions, `rate` is recalculated as `reward / spending` (the effective rate). This is correct because the marginal rate for a single transaction and the effective rate are the same when there's only one transaction. But it's a subtle correctness dependency that could break if `assignment.rate` computation changes.

**Suggested fix:** Always use `current.reward / current.spending` for consistency, or add a comment explaining why the first-transaction shortcut is safe.

---

### C17-10: `Taxonomy.findCategory` substring match iterates all keywords for every call — no short-circuit for long merchant names

**Severity:** LOW
**Confidence:** High
**File:** `packages/core/src/categorizer/taxonomy.ts:68-74`

Same as D-09/D-100. Not re-flagging. The O(n*m) cost is acceptable at current keyword counts.

---

### C17-11: `MerchantMatcher.match` rawCategory normalization replaces spaces with underscores but doesn't validate against taxonomy

**Severity:** MEDIUM
**Confidence:** Medium
**File:** `packages/core/src/categorizer/matcher.ts:84-87`

```ts
if (rawCategory && rawCategory.trim().length > 0) {
  const normalised = rawCategory.trim().toLowerCase().replace(/\s+/g, '_');
  return { category: normalised, confidence: 0.5 };
}
```

When a bank provides a raw category like "온라인 쇼핑" (with space), it's normalized to "온라인_쇼핑". This doesn't match any taxonomy category ID (which are English like "online_shopping"). The result is a category that doesn't exist in the taxonomy, leading to:
1. The category won't match any reward rules in `findRule` (which compares against `tx.category`)
2. The transaction gets 0 reward in the optimizer
3. The category displays as "온라인_쇼핑" in the UI (no Korean label from the taxonomy)

This is partially mitigated because most Korean bank statements use bank-specific category codes, not free-text Korean categories. But when a bank DOES provide Korean text categories, they'll create phantom categories.

**Concrete failure scenario:** User uploads a CSV from a bank that provides "외식" as a category. It's normalized to "외식" (no space, no change). This doesn't match the taxonomy ID "dining", so the transaction gets categorized as "외식" with 0.5 confidence and 0 reward.

**Suggested fix:** Add a reverse mapping from Korean category names to taxonomy IDs, or validate the normalized rawCategory against the taxonomy and fall back to 'uncategorized' if no match.

---

### C17-12: `playwright.config.ts` uses `bunx astro dev` for webServer command — may not match production build behavior

**Severity:** LOW
**Confidence:** Medium
**File:** `playwright.config.ts:17`

```ts
command: `cd apps/web && bunx astro dev --host ${host} --port ${port}`,
```

The E2E tests run against the dev server, not a production build. Dev mode has different behavior (hot module reload, source maps, different bundling). The `test:e2e` script in root `package.json` runs `turbo run build` before `playwright test`, but the playwright config overrides this by starting its own dev server.

This means E2E tests may pass in dev mode but fail in production, or vice versa.

**Suggested fix:** Change the webServer command to use the production preview server: `cd apps/web && bunx astro preview --host ${host} --port ${port}`.

---

### C17-13: `FileDropzone.svelte` number input uses `bind:value` with string state — iOS Safari numeric keyboard quirks

**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/components/upload/FileDropzone.svelte:200`

```ts
previousMonthSpending: (() => { const v = Number(previousSpending); return Number.isFinite(v) && v >= 0 ? v : undefined; })(),
```

`previousSpending` is declared as `$state<string>('')` and bound to an `<input type="number">`. On iOS Safari, `Number("1e5")` returns 100000, but `parseInt("1e5", 10)` returns 1. The `Number()` conversion here is correct for handling exponential notation. However, iOS Safari's number input can produce values like `"1e5"` in certain locales, which would pass the `Number.isFinite` check and create a `previousMonthSpending` of 100000 instead of the intended value.

Same class as D-28. The `Number()` conversion handles this correctly, but the risk is worth documenting.

---

### C17-14: `buildCardResults` recalculates rewards via `calculateCardOutput` — results may differ from `scoreCardsForTransaction` due to accumulated transactions

**Severity:** LOW
**Confidence:** Medium
**File:** `packages/core/src/optimizer/greedy.ts:204-241`

`buildCardResults` calls `calculateCardOutput` with all transactions assigned to each card. This produces the ACTUAL reward for the card given all its transactions. However, the per-transaction marginal rewards computed by `scoreCardsForTransaction` may not sum to the same total as `calculateCardOutput`'s result due to monthly cap interactions.

Example: Transaction A alone gives 5000 won reward. Transaction B alone gives 3000 won. But together, the monthly cap is 6000, so `calculateCardOutput` returns 6000. The sum of marginal rewards (5000 + 1000 = 6000) is correct because `scoreCardsForTransaction` computes marginal rewards AFTER previous assignments.

This is actually correct behavior — the marginal reward approach properly handles caps. The `buildCardResults` recalculation is used for the per-card breakdown display, while `buildAssignments` uses the marginal rewards for the per-category display. The two totals should be consistent.

However, `cardResults[i].totalReward` (from `calculateCardOutput`) may not equal the sum of `assignments.filter(a => a.assignedCardId === cardId).reduce((s, a) => s + a.reward, 0)` (from marginal rewards) due to rounding differences in `Math.floor`. This is a display inconsistency, not a correctness bug.

**Suggested fix:** Use `calculateCardOutput`'s `totalReward` as the authoritative per-card total and derive the per-category breakdown from it, rather than summing marginal rewards.

---

### C17-15: `inferYear` in pdf.ts uses `new Date()` — tests with short-date formats are non-deterministic

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/parser/pdf.ts:133`

Same as D-49/D-55/D-35. The `new Date()` call makes short-date parsing non-deterministic in tests. Not re-flagging.

---

## Summary of New Findings (Not in D-01 through D-103)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C17-01 | MEDIUM | High | `pdf.ts:180-183` | `parseAmount` returns NaN instead of 0 for unparseable inputs — fragile API contract |
| C17-02 | LOW | High | `pdf.ts:313` | `fallbackAmountPattern` uses `g` flag — safe as local variable but dangerous if moved to module scope |
| C17-03 | MEDIUM | High | `reward.ts:176-195` | No performance tier matched → all rewards skipped with no warning, silent 0 reward for CLI users with 0 previous spending |
| C17-07 | LOW | High | `ilp.ts:48` | ILP stub always warns on console — public API that always warns is misleading |
| C17-08 | LOW | High | `reward.ts:197-213` | Bucket object mutated before `set()` — fragile if loop is ever parallelized (same as D-87) |
| C17-09 | LOW | Medium | `greedy.ts:158-166` | Rate set from `assignment.rate` for first transaction but recalculated for subsequent — inconsistent source |
| C17-11 | MEDIUM | Medium | `matcher.ts:84-87` | rawCategory normalization doesn't validate against taxonomy — Korean text categories become phantom categories with 0 reward |
| C17-12 | LOW | Medium | `playwright.config.ts:17` | E2E tests run against dev server, not production build — may not catch production-only issues |
| C17-13 | LOW | Medium | `FileDropzone.svelte:200` | Number input string binding with iOS Safari exponential notation risk (same class as D-28) |
| C17-14 | LOW | Medium | `greedy.ts:204-241` | Per-card totalReward from `calculateCardOutput` may not equal sum of marginal rewards from assignments due to floor rounding |

---

## Final Sweep — No Missed Files

All source files examined:
- `packages/core/src/` — all .ts files (models, calculator, optimizer, categorizer)
- `apps/web/src/lib/` — analyzer.ts, cards.ts, store.svelte.ts, formatters.ts, parser/*
- `apps/web/src/components/` — all dashboard/*.svelte, upload/*.svelte, cards/*.svelte, ui/*.svelte
- `apps/web/src/pages/` — all .astro files
- `apps/web/src/layouts/` — Layout.astro
- `packages/core/src/optimizer/ilp.ts` — stub implementation
- `playwright.config.ts` — E2E test configuration
- `e2e/` — test specs (untracked, new)

All previously deferred items (D-01 through D-103) remain correctly deferred. No new CRITICAL findings. Three new MEDIUM findings (C17-01, C17-03, C17-11).
