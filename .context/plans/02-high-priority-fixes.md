# Plan 02 — High-Priority Fixes (H-01 through H-06)

**Priority:** HIGH
**Findings addressed:** H-01, H-02, H-03, H-04, H-05, H-06
**Status:** Completed

---

## Task 1: Fix `new Date().getFullYear()` in short-date parsing (H-01)

**Finding:** 6 instances of `new Date().getFullYear()` in date parsers assume current year, which is wrong for cross-year statements and timezone-dependent.

**Files:**
- `apps/web/src/lib/parser/csv.ts:46,59`
- `apps/web/src/lib/parser/xlsx.ts:218`
- `packages/parser/src/csv/generic.ts:59,66`
- `packages/parser/src/xlsx/index.ts:65`

**Implementation:**
1. Add a `referenceYear` parameter to `parseDateToISO` (default: current year)
2. When parsing short dates (MM/DD or Korean short dates), use the reference year
3. Apply a "look-back" heuristic: if the parsed date is more than 3 months in the future relative to "today", assume it belongs to the previous year
4. At the file level, try to infer the reference year from other fully-qualified dates in the same file
5. For CSV/XLSX parsers, scan the first few fully-qualified dates to establish the statement year before parsing short dates

**Simplified approach for this cycle:**
- Replace `new Date().getFullYear()` with a helper that uses a look-back heuristic:
```ts
function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  // If the candidate date is more than 3 months in the future, use previous year
  if (candidate.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}
```

**Commit:** `fix(parser): 🧭 add year-inference heuristic for short-date parsing`

---

## Task 2: Filter `performanceExclusions` from previous-month spending (H-02)

**Finding:** `analyzer.ts:94` sums all transaction amounts without filtering by `performanceExclusions`, inflating the previous-month spending that determines performance tier.

**Files:**
- `apps/web/src/lib/analyzer.ts:94`
- `packages/core/src/calculator/reward.ts` (no code checks exclusions)

**Implementation:**
1. In `analyzer.ts`, when calculating `totalSpendingThisMonth`, filter out transactions whose category matches any entry in the card's `performanceExclusions` list
2. This requires iterating over card rules to collect exclusion categories before computing spending
3. Since each card may have different exclusions, compute the spending *per card* rather than as a single total
4. Fall back to the current behavior (raw total) if no card rules are loaded yet

```ts
// In optimizeFromTransactions:
const allExclusions = new Set<string>();
for (const rule of cardRules) {
  for (const ex of rule.performanceExclusions) {
    allExclusions.add(ex);
  }
}
const qualifyingSpending = transactions
  .filter(tx => !allExclusions.has(tx.category))
  .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
const previousMonthSpending = options?.previousMonthSpending ?? qualifyingSpending;
```

**Note:** This is an approximation. Ideally, each card should compute its own qualifying spending based on its own exclusions. But for a first pass, using a union of all exclusions is conservative (excludes more) and safe.

**Commit:** `fix(core): 🛡️ filter performanceExclusions from previous-month spending`

---

## Task 3: Fix mixed all-month metadata in `analyzeMultipleFiles` (H-03)

**Finding:** `analyzer.ts:108-185` — `transactionCount` and `statementPeriod` cover all months, but optimization covers only the latest month.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Add separate fields for "total" vs "optimized" counts:
   - `transactionCount` → number of transactions in the optimized month only
   - `totalTransactionCount` → all transactions across all files
   - `statementPeriod` → period for the optimized month only
   - `fullStatementPeriod` → period spanning all uploaded files
2. Update the `AnalysisResult` type in `store.svelte.ts` to include these fields
3. Update UI components that display transaction counts to show the correct numbers

**Commit:** `fix(web): 🧩 separate optimized-month metrics from all-month totals`

---

## Task 4: Load CATEGORIES from taxonomy instead of hardcoding (H-04)

**Finding:** `TransactionReview.svelte:10-50` has a hardcoded 39-item category list that diverges from `categories.yaml`.

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. Import `loadCategories` from `../../lib/cards.js`
2. Build the CATEGORIES dropdown dynamically from the loaded taxonomy:
```ts
let categoryOptions = $state<{ id: string; label: string }[]>([]);

onMount(async () => {
  const nodes = await loadCategories();
  const options: { id: string; label: string }[] = [];
  for (const node of nodes) {
    options.push({ id: node.id, label: node.labelKo });
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        options.push({ id: sub.id, label: `  ${sub.labelKo}` });
      }
    }
  }
  categoryOptions = options;
});
```
3. Remove the hardcoded `CATEGORIES` array
4. Update the dropdown to use `categoryOptions`

**Commit:** `fix(web): 🔄 load category dropdown from taxonomy instead of hardcoding`

---

## Task 5: Replace `safeAmount` with `parseAmount` + NaN check in bank adapters (H-05)

**Finding:** `csv.ts:77-80` — `safeAmount` returns 0 for unparseable amounts, causing zero-value transactions to pass through silently.

**File:** `apps/web/src/lib/parser/csv.ts`

**Implementation:**
1. Replace all `safeAmount()` calls in bank adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc) with `parseAmount()` + NaN check
2. Push errors for unparseable amounts:
```ts
const amount = parseAmount(amountRaw);
if (Number.isNaN(amount)) {
  if (amountRaw.trim()) errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: line });
  continue;
}
```
3. Remove the `safeAmount` helper function after all usages are replaced

**Commit:** `fix(parser): 🐛 replace safeAmount with NaN-check error reporting in bank adapters`

---

## Task 6: Remove `bypassCSP: true` from E2E tests (H-06)

**Finding:** `e2e/ui-ux-review.spec.js:12` — E2E tests bypass CSP, hiding production CSP violations.

**File:** `e2e/ui-ux-review.spec.js`

**Implementation:**
1. Remove `test.use({ bypassCSP: true })` from the spec file
2. Run E2E tests to verify they pass with CSP enforcement
3. If tests fail, investigate and fix the underlying CSP issue rather than re-enabling the bypass

**Note:** Since CSP now includes `'unsafe-inline'`, the tests should pass. If we later tighten CSP (M-01), the E2E tests will help catch regressions.

**Commit:** `test(e2e): ✅ remove bypassCSP from E2E tests to enforce real CSP`

---

## Progress

- [x] Task 1: Fix short-date year inference — `0000000960`
- [x] Task 2: Filter performanceExclusions — `000000052`
- [x] Task 3: Separate optimized-month metrics — `00000000c8`
- [x] Task 4: Load categories from taxonomy — `0000000fe`
- [x] Task 5: Replace safeAmount with parseAmount + NaN check — `000000096c`
- [x] Task 6: Remove bypassCSP from E2E tests — `0000000184`
