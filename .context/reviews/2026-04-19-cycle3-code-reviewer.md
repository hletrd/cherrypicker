# Code Review — Cycle 3 (2026-04-19)

**Reviewer:** code-reviewer
**Scope:** Full repository — all packages, apps, tools, e2e

---

## Inventory of Reviewed Files

| Package | Files |
|---------|-------|
| packages/core | optimizer/greedy.ts, optimizer/constraints.ts, optimizer/ilp.ts, optimizer/index.ts, categorizer/taxonomy.ts, categorizer/matcher.ts, categorizer/index.ts, models/card.ts, models/transaction.ts, models/result.ts, models/index.ts, calculator/reward.ts, calculator/types.ts, calculator/discount.ts, calculator/points.ts, calculator/cashback.ts, calculator/index.ts, index.ts |
| packages/rules | schema.ts, loader.ts, types.ts, index.ts |
| packages/parser | pdf/llm-fallback.ts, pdf/extractor.ts, detect.ts, csv/*.ts, xlsx/adapters/index.ts |
| apps/web | lib/analyzer.ts, lib/store.svelte.ts, lib/formatters.ts, lib/cards.ts, lib/parser/pdf.ts, lib/parser/csv.ts, lib/parser/detect.ts, lib/parser/xlsx.ts, lib/parser/index.ts, lib/parser/types.ts, lib/categorizer-ai.ts, layouts/Layout.astro, components/dashboard/*.svelte, pages/*.astro, public/scripts/layout.js |
| e2e | ui-ux-review.spec.js |

---

## Findings

### C3-01: `findCategory` fuzzy match returns first match instead of longest match

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/categorizer/taxonomy.ts:85-89`
- **Description:** Step 3 of `findCategory` (reverse fuzzy match: "keyword contains merchant name") returns the **first** match found via `for...of` iteration over the Map. This is inconsistent with step 2 (substring match), which selects the **longest** keyword match. For example, if a merchant name "카페" matches both a keyword "카페" (exact, step 1) and "카페베네" (reverse fuzzy, step 3), the step 3 would return whichever Map entry is iterated first, not the most specific one. If two different categories have keywords that both contain the merchant name, the result is nondeterministic (depends on Map insertion order).
- **Failure scenario:** A merchant named "택시" could match keywords "카카오택시" (category: dining.delivery) and "UBER택시" (category: transportation) — whichever was inserted last in the Map wins, which may be wrong.
- **Fix:** In step 3, track the best match (shortest keyword that contains the merchant name — shortest = tightest fit) instead of returning the first match.

### C3-02: `normalizeRate` silently returns null for unknown rule types

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:113-117`
- **Description:** `normalizeRate` converts a percentage-form rate (e.g. 1.5 → 0.015) but returns `null` when the input rate is `null`. However, the caller at line 227 checks `normalizedRate !== null && normalizedRate > 0` — if `normalizedRate` is null and there is no `fixedAmount`, the code falls through to the `else` branch at line 237-240 where `rawReward = 0` and `applyMonthlyCap(0, ...)` is called. This results in `ruleMonthUsed` being incremented by 0 for every transaction, which is harmless but wasteful. More importantly, if a rule has `rate: null` but `fixedAmount > 0`, the code correctly handles it via the `hasFixedReward` branch. But if a rule has `rate: null` and `fixedAmount: null`, the transaction is silently skipped with zero reward and no error or warning. This means misconfigured YAML data (missing both rate and fixedAmount for a tier) will silently produce zero rewards.
- **Failure scenario:** A card rule YAML with `rate: null` and no `fixedAmount` for a tier will produce 0 reward for all transactions matching that category, with no indication to the user that the rule is misconfigured.
- **Fix:** Add a warning log when a rule is matched but has neither a positive rate nor a fixed amount. Alternatively, skip the rule entirely (as if no rule matched) so the transaction gets the default 0-reward treatment without incrementing tracking state.

### C3-03: `CATEGORY_NAMES_KO` in greedy.ts is incomplete and not sourced from taxonomy

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:7-50`
- **Description:** (Already noted in C2-A01 but with a new angle.) The `CATEGORY_NAMES_KO` map has ~45 entries, but the actual category taxonomy (from `categories.yaml`) is the authoritative source. Any new category added to the YAML will be missing from this hardcoded map, causing `categoryNameKo` in the optimization result to fall back to the raw category ID string. This is a data-freshness problem that will recur every time categories are updated.
- **Failure scenario:** A new YAML category `coffee` is added but not added to `CATEGORY_NAMES_KO`. The optimization result shows `coffee` instead of "커피" in the `categoryNameKo` field.
- **Fix:** Pass the taxonomy labels into the optimizer (or use the `CategoryTaxonomy.getCategoryLabel` method at result-building time) instead of maintaining a separate hardcoded map.

### C3-04: `SpendingSummary.svelte` uses `new Date()` with UTC/local mismatch

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:15-21`
- **Description:** The `formatPeriod` function creates `new Date(period.start)` and `new Date(period.end)`, which parses ISO date strings as UTC midnight but `getMonth()` returns local-time values. This is the same class of bug as the fixed C2-04 (in `formatters.ts`), but in a different file. While the cycle 2 fix addressed `formatDateKo` and `formatDateShort`, this component's `formatPeriod` function was not updated.
- **Failure scenario:** A statement period starting on "2026-01-01" displayed in UTC-5 timezone would show "12월" instead of "1월" because `new Date("2026-01-01").getMonth()` returns 11 (December) in UTC-5.
- **Fix:** Use the same manual date parsing approach as `formatDateKo`:
  ```ts
  function formatPeriod(period: { start: string; end: string } | undefined): string {
    if (!period) return '-';
    const [sy, sm] = period.start.split('-');
    const [ey, em] = period.end.split('-');
    const startStr = `${sy}년 ${parseInt(sm!, 10)}월`;
    const endStr = `${ey}년 ${parseInt(em!, 10)}월`;
    return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
  }
  ```

### C3-05: LLM fallback JSON regex can match nested arrays incorrectly

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/parser/src/pdf/llm-fallback.ts:75`
- **Description:** The regex `/\[[\s\S]*?\](?=\s*$|\s*```)/` uses a non-greedy match to find the first `]` followed by end-of-string or code fence. However, if the LLM response contains a nested JSON array (e.g. `[{"items": [1,2]}]`), the non-greedy match will stop at the first `]` (after `[1,2`), producing `[{"items": [1,2]` which is invalid JSON. The `JSON.parse` call will then throw, and the user gets "LLM이 올바른 JSON을 반환하지 않았습니다." without any indication of the parsing issue.
- **Failure scenario:** An LLM response that includes nested arrays in transaction objects would fail to parse, even though the actual JSON is valid.
- **Fix:** Use a more robust approach: extract the JSON by finding the first `[` and matching bracket, or try parsing from the first `[` to the last `]`.

### C3-06: `parseAndCategorize` uses array index as transaction ID

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:98`
- **Description:** Transaction IDs are generated as `tx-${idx}` using the array index. If the same file is parsed twice (e.g. user uploads the same file, edits categories, and re-optimizes), the IDs will collide with previous runs. More importantly, when `analyzeMultipleFiles` merges transactions from multiple files, each file's transactions start from `tx-0`, causing duplicate IDs across files.
- **Failure scenario:** Two files uploaded simultaneously both produce transactions with IDs `tx-0`, `tx-1`, etc. When merged, duplicate IDs could cause incorrect category edits in `TransactionReview.svelte` (the `changeCategory` function finds by ID).
- **Fix:** Use a unique prefix per file (e.g. `tx-${fileIdx}-${idx}`) or use `crypto.randomUUID()`.

### C3-07: `TransactionReview.svelte` `editedTxs` sync only runs once

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:124-129`
- **Description:** The `$effect` block syncs `editedTxs` from `analysisStore.transactions`, but only when `editedTxs.length === 0`. This means if the user uploads a new file (which replaces `analysisStore.transactions` with new data), the `editedTxs` will NOT be refreshed because they still have entries from the previous upload. The user would see stale transaction data in the review table.
- **Failure scenario:** User uploads file A (10 transactions), then uploads file B (5 transactions). The transaction review still shows the 10 transactions from file A because `editedTxs.length === 10` (not 0), so the effect does not re-sync.
- **Fix:** Track a version/generation counter from the store, or reset `editedTxs` to an empty array whenever the store's result changes, so the effect re-triggers.

### C3-08: `FileDropzone.svelte` uses `parseInt` for previousMonthSpending without validation

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:176-177`
- **Description:** `previousMonthSpending: previousSpending ? parseInt(previousSpending, 10) : undefined` — if the user types a non-numeric string that isn't empty (e.g. "abc"), `parseInt("abc", 10)` returns `NaN`, which gets passed to the analyzer. While the analyzer doesn't crash (NaN is handled gracefully in the optimizer), it would result in incorrect performance tier selection (no tier matches NaN spending), producing 0 rewards for all cards.
- **Failure scenario:** User accidentally types a letter in the spending input field. All cards show 0 rewards because no performance tier matches.
- **Fix:** Validate that `parseInt` returns a finite number before passing it: `const val = parseInt(previousSpending, 10); previousMonthSpending: Number.isFinite(val) ? val : undefined`.
