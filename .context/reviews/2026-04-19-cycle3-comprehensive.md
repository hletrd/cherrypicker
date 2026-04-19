# Comprehensive Code Review -- Cycle 3

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 3)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage, type safety

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-50 reviews and deferred items. Ran `bun test` (266 pass, 0 fail), `tsc --noEmit` per package (all pass except pre-existing test file issues in apps/web), and `bun run build` (all 7 tasks succeed). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Findings

All prior cycle 47-50 findings (C47-L01, C47-L02, C49-M01, C50-M01, C50-L01) are confirmed fixed:
- Terminal `formatWon`/`formatRate` have `Number.isFinite` guards + negative-zero normalization
- `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];`
- Server-side CSV adapter loop logs warnings
- Viz report generator and terminal summary now resolve Korean labels via `categoryLabels` parameter and `CATEGORY_NAMES_KO` fallback
- Report generator uses `replaceAll()` instead of `replace()`

Deferred items (D-106, D-107, D-110) remain deferred with documented rationale.

---

## New Findings

### C3-M01: `buildConstraints` does not pass `categoryLabels` through to the optimizer -- CLI report path still missing Korean labels for `cardResults.byCategory`

- **Severity:** MEDIUM (incorrect output)
- **Confidence:** High
- **File+line:** `tools/cli/src/commands/report.ts:136`
- **Description:** The CLI `runReport` command at line 136 calls `buildConstraints(categorized, cardPreviousSpending)` without passing the `categoryLabels` parameter. This means the `OptimizationConstraints` object has `categoryLabels` as `undefined`, and when `greedyOptimize` calls `buildCardResults`, the `categoryLabels` parameter is also `undefined`. As a result, `buildCardResults` at `greedy.ts:230` will fall through to `CATEGORY_NAMES_KO[r.category]` for the `byCategory` labels in `CardRewardResult`.

  While `CATEGORY_NAMES_KO` covers most categories, the dot-notation keys (e.g., `dining.cafe`) are included in the static map, so the fallback works for the currently known categories. However, the `categoryLabels` Map from the taxonomy is more complete and authoritative -- it is built from the YAML taxonomy data and includes all subcategories with their canonical Korean labels. The CLI is constructing this Map at lines 91-103 but not passing it to `buildConstraints`.

  The assignments and spending summary in the report DO correctly use Korean labels because `printOptimizationResult` receives the `categoryLabels` parameter and `buildCategoryTable`/`printSpendingSummary` also receive it. But the `cardResults.byCategory[].categoryNameKo` values in the `OptimizationResult` object will use the `CATEGORY_NAMES_KO` fallback rather than the taxonomy-derived labels.

  This is a consistency issue: the HTML report's card comparison section uses `result.cardResults[].byCategory[].categoryNameKo` for display, and those values come from `buildCardResults`. When the taxonomy has a label that differs from `CATEGORY_NAMES_KO`, the card comparison table will show a different Korean label than the spending summary table.

- **Concrete failure scenario:** If a new subcategory is added to the YAML taxonomy (e.g., `dining.bakery` with label `베이커리`) but not yet added to `CATEGORY_NAMES_KO` in `greedy.ts`, the CLI report's spending summary will show `베이커리` (from `categoryLabels`) but the card comparison section will show `dining.bakery` (the raw key, since it's not in `CATEGORY_NAMES_KO`).

- **Fix:** Add `categoryLabels` as the third argument to `buildConstraints` at `report.ts:136`:
  ```typescript
  const constraints = buildConstraints(categorized, cardPreviousSpending, categoryLabels);
  ```

### C3-M02: Web-side `loadFromStorage` restores `optimization` object without validating `cardResults` entries

- **Severity:** MEDIUM (correctness)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:159-213`
- **Description:** `loadFromStorage` validates the top-level `optimization` object (checking `assignments` is an array, `totalReward`/`totalSpending`/`effectiveRate` are numbers) but does not validate the `cardResults` array entries. Each `CardRewardResult` has `byCategory`, `capsHit`, `totalReward`, etc. If any of these nested fields are corrupted in sessionStorage, the dashboard components will receive malformed data that could cause rendering errors (e.g., `NaN` display, undefined property access).

  The `SavingsComparison.svelte` component accesses `opt.bestSingleCard.totalReward` and `opt.savingsVsSingleCard`, which ARE covered by the top-level validation. But `OptimalCardMap.svelte` and `CategoryBreakdown.svelte` iterate `cardResults` and `assignments` deeply, accessing fields like `byCategory[].categoryNameKo` and `capsHit[].capAmount` without defensive checks.

  This is partially addressed by D-91 (shallow validation of nested optimization data), which is currently deferred. The difference here is that D-91 focuses on sessionStorage being same-origin and therefore low-risk, while this finding focuses on the rendering consequence: if any `cardResults` entry is malformed, the dashboard will crash with an uncaught TypeError instead of gracefully degrading.

- **Concrete failure scenario:** A browser extension or debug tool modifies `sessionStorage` to set `cherrypicker:analysis.optimization.cardResults[0].byCategory` to a string instead of an array. On page reload, `loadFromStorage` passes validation (top-level fields are correct), but `CategoryBreakdown.svelte` tries to iterate `byCategory` and crashes with `byCategory.forEach is not a function`.

- **Fix:** Add a minimal validation check for `cardResults` in `loadFromStorage`: verify it's an array and each entry has `cardId` (string), `totalReward` (number), and `byCategory` (array). This is a shallow check that adds minimal overhead but prevents the most common crash scenarios.

### C3-L01: `previousMonthSpending` in CLI `report.ts` uses `parseInt` without NaN validation

- **Severity:** LOW (input validation)
- **Confidence:** High
- **File+line:** `tools/cli/src/commands/report.ts:50`
- **Description:** The `--prev-spending` CLI argument is parsed with `parseInt(args[i + 1]!, 10)` without checking for NaN. If the user passes a non-numeric value like `--prev-spending abc`, `parseInt("abc", 10)` returns NaN. This NaN is stored as `prevSpending` and eventually passed to `cardPreviousSpending.set(rule.card.id, prevSpending)` at line 132. The optimizer's `selectTier` function compares `previousMonthSpending >= t.minSpending` which evaluates to `false` for NaN, so no tier matches and all rewards are 0.

  While the optimizer handles this gracefully (no tier match means 0 reward, which is technically correct for "invalid input"), the user gets no feedback that their `--prev-spending` value was invalid. They would see 0 rewards with no explanation.

- **Concrete failure scenario:** `cherrypicker report statement.csv --prev-spending abc` produces a report with 0 rewards for all cards, with no error message about the invalid input.

- **Fix:** Add a NaN check after `parseInt` and throw an error with a clear message:
  ```typescript
  prevSpending = parseInt(args[i + 1]!, 10);
  if (Number.isNaN(prevSpending) || prevSpending < 0) {
    throw new Error(`전월실적은 0 이상의 숫자여야 합니다: ${args[i + 1]}`);
  }
  ```

### C3-L02: `getCardById` performs O(n) linear scan of all issuers and cards

- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/cards.ts:214-240`
- **Description:** `getCardById` iterates through all issuers and calls `issuer.cards.find()` for each one. With 683 cards across 10 issuers, this is O(10 * ~68) = O(680) per lookup. The `CardDetail.svelte` component calls `getCardById` on mount, and the cards index page may call it for each card. For the current card count, this is negligible (< 1ms). However, the function is also used in the search/filter path, and a card-by-ID Map would be O(1).

  This is the same class as D-09/D-51 (performance at scale) but specifically for the card lookup path rather than the optimizer. The function is called once per CardDetail mount and once per card in the grid, so it's unlikely to be a bottleneck.

- **Concrete failure scenario:** If the card count grows to 5000+, `getCardById` calls from a card grid would take noticeable time on low-end devices.
- **Fix:** Build a `Map<string, CardRuleSet>` index when `loadCardsData()` is first called, and use it for O(1) lookups in `getCardById`.

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations are consistent** -- all 4 implementations (web formatters, viz report generator, viz terminal summary) have `Number.isFinite` guards and negative-zero normalization. Verified.

2. **All `formatRate` implementations are consistent** -- all 5 implementations have `Number.isFinite` guards. Verified.

3. **TypeScript build is clean** for all packages. Apps/web test file errors (`bun:test` module) are pre-existing and documented. The `llm-fallback.ts` TS2454 fix is confirmed.

4. **Reward calculation consistency** -- `calculateDiscount`, `calculatePoints`, `calculateCashback` all delegate to `calculatePercentageReward`. The `getCalcFn` function in `reward.ts` correctly maps all four types. Mileage uses the points calculator. No divergence.

5. **`buildCategoryKey` export** -- `packages/core/src/index.ts:18` exports `buildCategoryKey` (D-102 is fixed). Verified.

6. **SessionStorage validation** -- `isValidTx` checks `Number.isFinite(tx.amount) && tx.amount > 0` (D-99 is fixed). Verified.

7. **Web-side vs server-side parser consistency** -- Both have identical date validation (month 1-12, day 1-31), encoding detection, and amount parsing. The remaining inconsistency is D-106 (bare `catch {}` in web PDF parser).

8. **Category labels are now consistent across all paths** -- Web dashboard (`store.svelte.ts`, `analyzer.ts`), CLI report (`report.ts`), viz report generator, and terminal summary all resolve Korean labels via `categoryLabels` Map with `CATEGORY_NAMES_KO` fallback. The one remaining gap is C3-M01 (CLI not passing `categoryLabels` to `buildConstraints`).

9. **No new security issues found.** LLM fallback is server-side only with browser guard, API key from env, 30-second timeout, text truncation. No secrets in code.

10. **No new performance issues found.** All previously identified performance concerns remain deferred and are acceptable at current scale.

11. **No new UI/UX issues found.** CategoryBreakdown colors, SavingsComparison animation, FileDropzone validation all previously reviewed and deferred items documented.

---

## Summary of Active Findings

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C3-M01 | MEDIUM | High | `tools/cli/src/commands/report.ts:136` | CLI report does not pass `categoryLabels` to `buildConstraints` -- `cardResults.byCategory[].categoryNameKo` uses `CATEGORY_NAMES_KO` fallback instead of taxonomy labels | NEW, needs fix |
| C3-M02 | MEDIUM | Medium | `apps/web/src/lib/store.svelte.ts:159-213` | `loadFromStorage` does not validate `cardResults` entries -- malformed nested data can crash dashboard components | NEW, low priority |
| C3-L01 | LOW | High | `tools/cli/src/commands/report.ts:50` | `--prev-spending` CLI argument parsed with `parseInt` without NaN validation | NEW, needs fix |
| C3-L02 | LOW | High | `apps/web/src/lib/cards.ts:214-240` | `getCardById` performs O(n) linear scan of all issuers and cards | NEW, low priority |
