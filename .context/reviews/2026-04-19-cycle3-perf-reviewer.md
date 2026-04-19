# Performance Review — Cycle 3 (2026-04-19)

**Reviewer:** perf-reviewer
**Scope:** CPU, memory, UI responsiveness, concurrency

---

## Findings

### C3-P01: `scoreCardsForTransaction` recalculates full `calculateRewards` per card per transaction

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:84-110`
- **Description:** (Already deferred as D-09, but adding a new angle.) Each call to `scoreCardsForTransaction` computes `calculateCardOutput` twice per card (before and after adding the transaction). For N transactions, M cards, this is O(N * M * T) where T is the average transaction count per card. The inner `calculateRewards` call iterates all assigned transactions for that card, which grows as more transactions are assigned. For 1000 transactions and 5 cards, the total work is roughly O(N^2 * M) = 5,000,000 `calculateRewards` iterations. This takes several seconds on a mobile device.
- **Failure scenario:** A user with a large statement (500+ transactions) on a mid-range phone waits 5+ seconds for the optimization to complete.
- **Fix:** (Already deferred as D-09.) Consider caching the previous `calculateCardOutput` result and only recomputing the delta for the new transaction.

### C3-P02: `TransactionReview.svelte` renders all transactions in DOM simultaneously

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:236-295`
- **Description:** (Already noted as C2-U01/D-25 but with a performance angle.) Each transaction row contains a `<select>` element with all category options (typically 45+ options). For 200 transactions, this creates 200 `<select>` elements with 45+ `<option>` elements each = 9,000+ DOM nodes just for the category dropdowns. This causes noticeable lag when expanding the transaction review section.
- **Failure scenario:** User with 300 transactions expands the review section. The browser takes 1-2 seconds to render the table, and scrolling is janky.
- **Fix:** (Already deferred as D-25.) Use virtual scrolling or lazy rendering for the transaction table.

### C3-P03: PDF text extraction uses string concatenation in a loop

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:236-244`
- **Description:** (Already noted as C2-P02/D-16.) The loop `fullText += pageText + '\n'` creates a new string for each page. For a 50-page PDF, this is 50 string allocations. The performance impact is minimal for typical card statements (< 10 pages), but the fix (using array + join) is trivial.
- **Fix:** (Already deferred as D-16.)

### C3-P04: `loadCategories` and `loadCardsData` make separate fetch calls

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/cards.ts:144-178`
- **Description:** `loadCategories()` and `loadCardsData()` make separate HTTP requests for `categories.json` and `cards.json`. On slow connections (3G), this adds an extra round-trip. The categories data is also embedded in `cards.json` under the `categories` key, so a single request would suffice.
- **Failure scenario:** On a 3G connection, the second fetch adds 200-500ms of latency.
- **Fix:** Extract categories from `cards.json.categories` instead of making a separate fetch for `categories.json`. Or keep both for backward compatibility but make `loadCategories` prefer the already-loaded `cardsPromise` data.
