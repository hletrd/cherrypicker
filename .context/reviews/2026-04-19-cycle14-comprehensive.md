# Cycle 14 — Comprehensive Multi-Angle Code Review

**Date:** 2026-04-19
**Reviewer:** All specialist angles (code quality, performance, security, architecture, debugger, test, UI/UX)
**Scope:** Full repository — all packages/core, apps/web, packages/rules, tools

---

## Verification of Prior Cycle Findings

### Previously Fixed (Confirmed in Current Code)

| Finding | Status | Evidence |
|---------|--------|----------|
| C13-01 | FIXED | `csv.ts:54` now uses `padStart(2, '0')` in short-year branch |
| C13-02 | FIXED | `pdf.ts:150` now uses `padStart(2, '0')` in short-year branch |
| C13-12 | FIXED | `parser-date.test.ts` exists with comprehensive date parsing tests |
| C13-13 | FIXED | `reward-cap-rollback.test.ts` exists with 6 tests for global cap rollback |
| C13-16 | FIXED | `FileDropzone.svelte:401` now says "전월" instead of "전전월" |
| C11-10 | FIXED | `reward.ts:201` uses `rewardType: 'none'` for no-rule categories |
| C12-14 | FIXED | `xlsx.ts:245` uses `Math.round(raw)` for numeric amounts |
| C12-16 | FIXED | `store.svelte.ts:147` checks `Number.isFinite(tx.amount)` |

### Previously Deferred (Still Deferred)

All prior deferred items (D-01 through D-85, C13-03 through C13-15, C13-17) remain LOW severity and unchanged.

---

## New Findings

### C14-01: `buildAssignments` uses `tx.category` instead of `categoryKey` for assignment grouping — subcategory spending split is incorrect

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:117`
- **Description:** `buildAssignments` groups transactions by `${assignment.tx.category}::${assignment.assignedCardId}`. But `tx.category` is the *parent* category (e.g., `dining`), not the `categoryKey` that includes the subcategory (e.g., `dining.cafe`). This means when a card has both `dining` and `dining.cafe` transactions, they get merged into a single assignment row with category "dining", hiding the subcategory breakdown. The reward is correctly computed per subcategory in `calculateRewards`, but the assignment display loses the subcategory distinction.
- **Concrete failure scenario:** A user has 3 dining transactions (100,000 Won) and 2 cafe transactions (50,000 Won) assigned to the same card. The assignment shows one row: category="dining", spending=150,000 Won, which is misleading because cafe is a distinct subcategory with potentially different reward rates.
- **Fix:** Use `buildCategoryKey(assignment.tx.category, assignment.tx.subcategory)` for the grouping key in `buildAssignments`, same pattern used in `reward.ts:190`.

### C14-02: `isValidTx` doesn't validate `tx.id` uniqueness — duplicate IDs would corrupt reoptimization

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:139-151`
- **Description:** `isValidTx` validates each transaction independently but doesn't check for duplicate IDs. If sessionStorage contains two transactions with the same `id` (e.g., from a corrupted merge), both would pass validation. The `changeCategory` function in `TransactionReview.svelte:160` uses `editedTxs.find(t => t.id === txId)` which would only modify the first matching transaction, silently ignoring the duplicate.
- **Concrete failure scenario:** After a partial write + re-save to sessionStorage, two transactions end up with `id: "tx-0"`. The user changes the category of one, but `find()` only modifies the first. The second duplicate keeps its old category and distorts the optimization.
- **Fix:** Add a deduplication pass in `loadFromStorage` that filters out transactions with duplicate IDs, keeping only the first occurrence.

### C14-03: `TransactionReview.svelte` search is case-sensitive for ASCII — inconsistent with Korean case-insensitivity

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:151`
- **Description:** The search filter uses `tx.merchant.toLowerCase().includes(q)` where `q = searchQuery.trim().toLowerCase()`. This correctly lowercases both sides for ASCII comparison. However, Korean text doesn't have case, so `.toLowerCase()` is a no-op for Korean characters. The behavior is correct, but the search doesn't handle half-width/full-width Latin characters (e.g., `Ａ` vs `A`) that sometimes appear in Korean card statement merchant names. A merchant stored as "ＡＴＭ" wouldn't be found by searching "atm".
- **Concrete failure scenario:** User searches for "ATM" but the merchant is stored as "ＡＴＭ" (full-width) from the card statement. No results appear despite the merchant being in the list.
- **Fix:** Normalize full-width Latin to ASCII before comparison using `String.prototype.normalize('NFKC')` on both the query and merchant name.

### C14-04: `cachedCoreRules` in `analyzer.ts` never invalidates — stale rules if cards.json is updated mid-session

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:47, 194-196`
- **Description:** `cachedCoreRules` is a module-level variable that persists for the entire session. Once set, it never invalidates even if `cards.json` is updated (e.g., after a redeploy). Since `cardsPromise` in `cards.ts:137` also caches the fetch, this is consistent — both caches live for the session. This is by design for a static site, but worth noting.
- **Concrete failure scenario:** The site is redeployed with new card rules while a user has an active session. The user's optimization uses stale rules until they reload the page.
- **Fix:** No action needed for a static site. This is acceptable behavior. Document as a known limitation.

### C14-05: `scoreCardsForTransaction` mutation of `assignedTransactionsByCard` via `currentTransactions.push` — subtle side effect

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:235-237`
- **Description:** In `greedyOptimize`, after finding the best card, the transaction is pushed directly onto the array retrieved from `assignedTransactionsByCard`. This works because `assignedTransactionsByCard.get(best.cardId)` returns a reference to the same array that was set earlier (line 216). However, if `scoreCardsForTransaction` were to be called again after this mutation (e.g., in a retry loop), the already-assigned transaction would be included in the "before" calculation, producing incorrect marginal rewards. This is not currently a bug because the optimizer processes transactions sequentially and only calls `scoreCardsForTransaction` once per transaction.
- **Concrete failure scenario:** Not a current bug — would only become one if the optimizer were refactored to support backtracking or re-scoring.
- **Fix:** No action needed now. Consider adding a comment documenting the mutation contract.

### C14-06: `parseAmount` in CSV parser doesn't handle scientific notation — `parseInt` silently truncates

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/csv.ts:88`
- **Description:** `parseAmount` uses `parseInt(cleaned, 10)`. If a CSV cell contains scientific notation like "1.5E6" (1,500,000), `parseInt` would parse only the "1" before the dot, returning 1 instead of 1500000. The XLSX parser handles this correctly because it receives numeric values from the XLSX library rather than strings. In practice, Korean card CSV exports never use scientific notation, so this is a theoretical concern.
- **Concrete failure scenario:** A custom CSV file with a formula-generated amount in scientific notation would be parsed as 1 Won instead of the correct amount.
- **Fix:** Consider using `parseFloat` followed by `Math.round` for consistency, or add a check for `E`/`e` in the cleaned string. Low priority given Korean card CSV conventions.

### C14-07: `Layout.astro` reads `cards.json` at build time but has hardcoded fallback values — stale defaults if build fails partially

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/layouts/Layout.astro:15-24`
- **Description:** The Layout component reads `cards.json` at build time to get `totalCards`, `totalIssuers`, and `totalCategories`. If the file read fails (caught by the empty `catch {}`), hardcoded fallback values of 683, 24, and 45 are used. These fallbacks will become stale as the card database grows. The empty catch block also silently swallows file system errors.
- **Concrete failure scenario:** During a build, `cards.json` is missing because the scraper hasn't been run yet. The built site shows "683+ 카드" instead of the actual count.
- **Fix:** Log a warning when the fallback is used: `catch (err) { console.warn('[cherrypicker] cards.json not found, using fallback stats'); }`. Update fallback values periodically or derive them from a build-time constant.

### C14-08: `FileDropzone.svelte` page-level drag-and-drop listeners are never cleaned up on navigation

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:12-43`
- **Description:** The `onMount` callback registers `dragenter`, `dragleave`, `dragover`, and `drop` listeners on `document`. The returned cleanup function removes them. However, since Astro uses full page navigation (no SPA routing), the component is destroyed and recreated on every navigation. If the component were to be used in a SPA context (e.g., with Astro View Transitions), the cleanup would work correctly because `onDestroy` is called. Currently, the behavior is correct but the `dragCount` variable could leak if the component is destroyed mid-drag (dragenter fired but dragleave never fires).
- **Concrete failure scenario:** User drags a file over the page, then navigates away. The `dragCount` is never reset to 0. When they navigate back, `isDragOver` could be stuck as `true` if the component state is preserved (not currently the case with full-page navigation).
- **Fix:** Add `dragCount = 0; isDragOver = false;` in the `onMount` cleanup function. Low priority since the current navigation model doesn't preserve state.

---

## Final Sweep — Cross-File Interactions

### C14-09: `normalizeRate` divides by 100 but YAML rates for mileage are stored as per-unit, not percentage

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `packages/core/src/calculator/reward.ts:113-117`
- **Description:** `normalizeRate` divides all rates by 100 (e.g., 1.5 -> 0.015 for 1.5%). This is correct for discount, points, and cashback rates which are expressed as percentages. However, mileage rates in Korean card terms are typically expressed as "miles per 1500 Won" (e.g., 1 mile per 1500 Won) rather than as a percentage. If a mileage rule has `rate: 1` (meaning 1 mile per transaction unit), `normalizeRate` would convert it to 0.01, which is incorrect. The `calculateFixedReward` function at line 152-154 handles mileage correctly using `unit: 'mile_per_1500won'`, but only when `fixedAmount` is set. If a mileage rule uses a percentage-style rate instead of fixedAmount, the normalization would produce wrong results.
- **Concrete failure scenario:** A mileage card rule has `rate: 1, type: 'mileage'` intending "1 mile per 1% of spending". After `normalizeRate`, it becomes 0.01, meaning the reward is calculated as `floor(amount * 0.01)` = 1% cash equivalent, which may or may not match the card's actual terms. This depends on how the YAML data is authored.
- **Fix:** Verify all mileage rules in `packages/rules/data/` use `fixedAmount` + `unit: 'mile_per_1500won'` instead of percentage rates. If any use percentage rates, document that the `normalizeRate` behavior is intentional for mileage percentage terms.

### C14-10: `findRule` matches wildcard rules (`category: '*'`) even for categories that have specific rules — specificity ordering may not prevent suboptimal matches

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/calculator/reward.ts:63-88`
- **Description:** `findRule` collects all candidate rules and sorts by `ruleSpecificity` descending. A wildcard rule (`category: '*'`) has specificity 0 (no category, no subcategory), while a specific rule (e.g., `category: 'dining'`) has specificity >= 100. So the specific rule always wins. However, if a card has only a wildcard rule and no specific rule for a category, the wildcard applies. This is correct behavior — the wildcard is a fallback. But if two cards are compared by the optimizer, and one has a specific 3% dining rule while the other has a wildcard 1% rule, the optimizer correctly picks the 3% card for dining transactions. No bug here.
- **Concrete failure scenario:** Not a bug — specificity ordering works correctly.
- **Fix:** No action needed. The logic is correct.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C14-01 | MEDIUM | High | `greedy.ts:117` | `buildAssignments` uses `tx.category` instead of `categoryKey` — subcategory breakdown lost in assignment display |
| C14-02 | LOW | Medium | `store.svelte.ts:139-151` | `isValidTx` doesn't check for duplicate IDs — could corrupt reoptimization |
| C14-03 | LOW | High | `TransactionReview.svelte:151` | Search doesn't normalize full-width Latin characters |
| C14-04 | LOW | High | `analyzer.ts:47, 194-196` | `cachedCoreRules` never invalidates — by design for static site |
| C14-05 | LOW | High | `greedy.ts:235-237` | Array mutation via push is a side effect — documented, not a current bug |
| C14-06 | LOW | Medium | `csv.ts:88` | `parseInt` silently truncates scientific notation — not seen in Korean CSVs |
| C14-07 | LOW | Medium | `Layout.astro:15-24` | Hardcoded fallback stats in catch block will become stale |
| C14-08 | LOW | Medium | `FileDropzone.svelte:12-43` | Page-level drag listeners could leak dragCount on SPA navigation |
| C14-09 | MEDIUM | Medium | `reward.ts:113-117` | `normalizeRate` divides mileage rates by 100 — verify YAML data uses fixedAmount for mileage |
| C14-10 | LOW | Medium | `reward.ts:63-88` | Wildcard rule matching — confirmed correct, specificity ordering works |

---

## Actionable Findings

### HIGH (should fix this cycle)
1. C14-01: Fix `buildAssignments` to use `categoryKey` for grouping, preserving subcategory breakdown
2. C14-09: Verify mileage YAML rules use `fixedAmount` instead of percentage rates

### LOW (defer or accept)
- C14-02 (defense-in-depth for duplicate IDs), C14-03 (full-width Latin normalization), C14-04 (by design), C14-05 (documented), C14-06 (not seen in practice), C14-07 (cosmetic), C14-08 (not a current issue), C14-10 (confirmed correct)
