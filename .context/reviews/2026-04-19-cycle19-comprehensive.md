# Cycle 19 Comprehensive Review — 2026-04-19

**Reviewer:** Multi-angle comprehensive review (code-quality, perf, security, UX, architecture, testing, correctness)
**Scope:** Full codebase, cross-file interactions, new findings not in D-01 through D-103 or C18-01 through C18-04

---

## Verification of Cycle 18 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C18-01 (empty previousSpending → 0) | FIXED | `FileDropzone.svelte:200` — empty string now checked before Number() |
| C18-02 (duplicate dropdown values) | FIXED | `TransactionReview.svelte:58-63` — fully-qualified subcategory IDs |
| C18-03 (unnecessary type cast) | FIXED | `CardDetail.svelte:50-53` — direct property access |
| C18-04 (min keyword length guard) | FIXED | `taxonomy.ts:72` — `kw.trim().length < 2` guard added |

---

## New Findings

### C19-01: `reoptimize` filters to latest month but `previousMonthSpending` uses edited transactions from ALL months — cap distortion

**Severity:** HIGH
**Confidence:** High
**File:** `apps/web/src/lib/store.svelte.ts:341-348` and `apps/web/src/lib/analyzer.ts:170-185`

When `reoptimize` is called with edited transactions, it filters to the latest month for the optimization itself (`latestTransactions`), but passes `options` without `previousMonthSpending`, so `optimizeFromTransactions` computes per-card `previousMonthSpending` from the `latestTransactions` (only latest month). However, the comment at `analyzer.ts:310-312` says non-latest-month transactions "don't distort the optimization" but this is only true for the initial `analyzeMultipleFiles` flow where `previousMonthSpending` is explicitly calculated from the previous month's spending.

In `reoptimize`, if the user edited transactions (e.g., changed a category or amount), the `latestTransactions` passed to `optimizeFromTransactions` are derived from the *edited* transactions. When `previousMonthSpending` is computed in `optimizeFromTransactions` (the `else` branch at line 177), it uses `transactions` (which are the latest-month-only transactions) to compute each card's qualifying spending. This means the previous-month spending is calculated from the *same* transactions being optimized, creating a circular dependency: the spending that determines the performance tier is derived from the same transactions whose rewards depend on the tier.

In contrast, `analyzeMultipleFiles` correctly uses the *previous* month's spending (not the optimized month's) for `previousMonthSpending`. The `reoptimize` path has no equivalent of "previous month's spending."

**Concrete failure scenario:** User uploads January+February statements. Initial optimization uses January spending for `previousMonthSpending` (correct). User edits a February transaction. `reoptimize` filters to February transactions only and passes them to `optimizeFromTransactions` without `previousMonthSpending`. The function then computes `previousMonthSpending` from February transactions (the same month being optimized). For a card with a 500K minimum tier, if February spending is 600K, the card qualifies for the tier — but the tier qualification should depend on *January's* spending (which was 400K in this scenario), not February's. The user gets a misleadingly higher reward.

**Suggested fix:** When calling `optimizeFromTransactions` from `reoptimize`, pass the previous month's spending from the original analysis result's `monthlyBreakdown`:

```ts
// In reoptimize, compute previousMonthSpending from monthlyBreakdown
const months = [...new Set(editedTransactions.map(tx => tx.date.slice(0, 7)))].sort();
const latestMonth = months[months.length - 1];
const previousMonth = months.length >= 2 ? months[months.length - 2] : null;
let previousMonthSpending: number | undefined;
if (previousMonth && result.monthlyBreakdown) {
  const prevData = result.monthlyBreakdown.find(m => m.month === previousMonth);
  previousMonthSpending = prevData?.spending;
}
const optimization = await optimizeFromTransactions(latestTransactions, {
  ...options,
  previousMonthSpending,
}, categoryLabels);
```

**Commit:** `fix(web): 🐛 compute reoptimize previousMonthSpending from previous month, not same month`

---

### C19-02: `getCategoryLabels` in store builds labels with subcategory `id` but `buildCategoryKey` in optimizer uses `category.subcategory` — label lookup misses dot-notation keys

**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/lib/store.svelte.ts:244-258` and `packages/core/src/calculator/reward.ts:28-29`

`getCategoryLabels` iterates `node.subcategories` and calls `labels.set(sub.id, sub.labelKo)`. This sets keys like `"cafe"`, `"supermarket"`, etc. But `buildCategoryKey` in `reward.ts` constructs keys as `"dining.cafe"`, `"grocery.supermarket"` (dot-notation). When `buildAssignments` in `greedy.ts` looks up `categoryLabels.get(categoryKey)`, it queries for `"dining.cafe"` but the Map only has `"cafe"` — so the lookup returns `undefined` and falls through to `CATEGORY_NAMES_KO`.

This is partially mitigated because `CATEGORY_NAMES_KO` in `greedy.ts` has both dot-notation keys (e.g., `'dining.cafe': '카페'`) and standalone keys. But the `categoryLabels` Map is supposed to be the authoritative source (from taxonomy data), and it's incomplete. If a new subcategory is added to the taxonomy but not to `CATEGORY_NAMES_KO`, it will display as the raw category key (e.g., `"dining.new_sub"`) instead of the Korean label.

**Concrete failure scenario:** A new subcategory `dining.bakery` is added to `categories.yaml` with `labelKo: "베이커리"`. `getCategoryLabels` sets `labels.set("bakery", "베이커리")`. The optimizer constructs categoryKey `"dining.bakery"`. `categoryLabels.get("dining.bakery")` returns `undefined`. Falls through to `CATEGORY_NAMES_KO["dining.bakery"]` which doesn't exist either. Result: the dashboard shows the raw key `"dining.bakery"` instead of "베이커리".

**Suggested fix:** In `getCategoryLabels`, also set dot-notation keys:

```ts
for (const node of nodes) {
  labels.set(node.id, node.labelKo);
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      labels.set(sub.id, sub.labelKo);
      labels.set(`${node.id}.${sub.id}`, sub.labelKo);  // dot-notation key
    }
  }
}
```

The same fix should be applied in `analyzer.ts:192-199` and `analyzer.ts:244-255` where category labels are built inline.

**Commit:** `fix(web): 🐛 add dot-notation subcategory keys to categoryLabels Map for optimizer lookups`

---

### C19-03: `CardGrid` issuer filter shows issuers with 0 matching cards after type filter is applied

**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/components/cards/CardGrid.svelte:22`

```ts
let availableIssuers = $derived([...new Set(cards.map(c => c.issuer))].sort());
```

`availableIssuers` is derived from `cards` (the full unfiltered list), not from `filteredCards`. This means when the user selects "체크카드" type filter, issuers that only have credit cards still appear in the issuer pill bar. Clicking on such an issuer shows "검색 결과가 없어요" with no cards, which is confusing.

**Concrete failure scenario:** User clicks "체크카드" tab. Issuer bar shows "현대카드" (which has 50 credit cards and 0 check cards). User clicks "현대카드". Result: "검색 결과가 없어요" — the issuer filter appears broken.

**Suggested fix:** Derive `availableIssuers` from `filteredCards` (after type filter):

```ts
let availableIssuers = $derived([...new Set(filteredCards.map(c => c.issuer))].sort());
```

**Commit:** `fix(web): 🐛 derive availableIssuers from filtered cards so issuers with 0 matching cards are hidden`

---

### C19-04: `SpendingSummary` uses `formatPeriod` with `split('-')` that breaks on short date strings

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:16-25`

```ts
function formatPeriod(period: { start: string; end: string } | undefined): string {
  if (!period) return '-';
  const [sy, sm] = period.start.split('-');
  const [ey, em] = period.end.split('-');
  if (!sy || !sm || !ey || !em) return '-';
  const smNum = parseInt(sm, 10);
  const emNum = parseInt(em, 10);
  if (Number.isNaN(smNum) || Number.isNaN(emNum)) return '-';
  ...
}
```

The `split('-')` approach works for ISO dates but the destructuring `[sy, sm]` only captures the first two parts. If `period.start` is something unexpected (e.g., an empty string or a malformed date), `split('-')` might return `['']`, and `sm` would be `undefined`. The `!sy || !sm` check handles this, but the code is fragile — `split` returns at most the number of `-` separated parts, so a date like `"2026"` (missing month/day) would give `sy='2026'`, `sm=undefined`, which is correctly caught.

However, a more robust approach would be `period.start.slice(0, 7)` (extract YYYY-MM) since all dates are ISO 8601. This avoids the split entirely and is more consistent with how dates are handled elsewhere (e.g., `tx.date.slice(0, 7)`).

**Suggested fix:**

```ts
function formatPeriod(period: { start: string; end: string } | undefined): string {
  if (!period) return '-';
  const startYM = period.start.slice(0, 7);
  const endYM = period.end.slice(0, 7);
  if (!startYMM || !endYMM || startYM.length < 7 || endYM.length < 7) return '-';
  const [sy, sm] = startYM.split('-');
  const [ey, em] = endYM.split('-');
  ...
}
```

This is a minor robustness improvement — deferrable.

**Commit:** `refactor(web): ♻️ use date.slice for period formatting robustness`

---

### C19-05: `dashboard.astro` renders both empty state and data content divs simultaneously

**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/pages/dashboard.astro:31-119`

The dashboard.astro page renders both `#dashboard-empty-state` and `#dashboard-data-content` divs unconditionally. A client-side script (`dashboard.js`) toggles visibility between them. This means both DOM trees are hydrated by Svelte even when one is hidden. The `client:load` directive on all 5 components means they all mount and run their derived/effect logic even when the empty state is visible.

This was previously identified as D-38. I'm re-raising it with additional context: the 5 components with `client:load` each fetch data or derive state on mount. `SpendingSummary`, `CategoryBreakdown`, `OptimalCardMap`, `SavingsComparison` all subscribe to `analysisStore` and run derivations. `TransactionReview` calls `loadCategories()` on mount even when the empty state is shown. This is a waste of network and CPU on first load.

**Suggested fix:** Use `client:visible` instead of `client:load` for components inside `#dashboard-data-content`, or conditionally render the data content section only when `analysisStore.result` is non-null (using a single Svelte island wrapper with `client:load` that checks the store).

This was previously deferred as D-38. Re-raising with the performance angle (unnecessary `loadCategories()` fetch on every dashboard page visit).

---

### C19-06: `CardDetail.svelte` fetch fires on every `cardId` change but has no AbortController cleanup

**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/components/cards/CardDetail.svelte:55-70`

The `$effect` fires a fetch when `cardId` changes. The `fetchGeneration` counter correctly prevents stale responses from corrupting state. However, there's no `AbortController` to cancel the in-flight fetch when the component is destroyed or when `cardId` changes rapidly. The in-flight fetch will complete and its response will be silently discarded (due to `fetchGeneration` check), but the network request continues consuming bandwidth.

This was previously identified as D-62. Re-confirming as still present. The stale-response guard works correctly; the missing AbortController is a minor resource waste.

---

## Summary of New Findings (Not in D-01 through D-103 or C18-01 through C18-04)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C19-01 | HIGH | High | `store.svelte.ts:341-348`, `analyzer.ts:170-185` | `reoptimize` computes previousMonthSpending from same month being optimized instead of previous month — cap distortion |
| C19-02 | MEDIUM | High | `store.svelte.ts:244-258`, `reward.ts:28-29` | `getCategoryLabels` doesn't set dot-notation subcategory keys — new subcategories show raw keys |
| C19-03 | MEDIUM | High | `CardGrid.svelte:22` | Issuer filter shows issuers with 0 matching cards after type filter |
| C19-04 | LOW | High | `SpendingSummary.svelte:16-25` | `formatPeriod` uses fragile `split('-')` instead of `slice` |
| C19-05 | LOW | High | `dashboard.astro:31-119` | Both empty state and data content divs hydrate simultaneously — waste of fetch and CPU (extends D-38) |
| C19-06 | LOW | Medium | `CardDetail.svelte:55-70` | No AbortController cleanup on fetch — in-flight requests continue after component destroy (extends D-62) |

---

## Final Sweep — No Missed Files

All source files examined:
- `packages/core/src/` — all .ts files (models, calculator, optimizer, categorizer)
- `apps/web/src/lib/` — analyzer.ts, cards.ts, store.svelte.ts, formatters.ts, api.ts, parser/*, categorizer-ai.ts
- `apps/web/src/components/` — all dashboard/*.svelte, upload/*.svelte, cards/*.svelte, ui/*.svelte
- `apps/web/src/pages/` — all .astro files
- `apps/web/src/layouts/` — Layout.astro
- `e2e/` — ui-ux-review.spec.js
- `tools/` — cli and scraper

All previously deferred items (D-01 through D-103) remain correctly deferred. One new HIGH finding (C19-01) that produces incorrect optimization results during reoptimize when multi-month data is present.
