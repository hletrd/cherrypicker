# Cycle 68 Comprehensive Code Review -- 2026-04-22

**Scope:** Full re-read of all source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper. Cross-file interaction analysis. Fix verification of prior cycle findings. New issue discovery.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-67 findings are confirmed fixed except as noted in the aggregate.

| Finding | Status | Evidence |
|---|---|---|
| C67-01 | OPEN (MEDIUM) | `packages/core/src/optimizer/greedy.ts:120-146` `scoreCardsForTransaction` still recalculates ALL card rewards for every transaction. No change since last cycle. |
| C67-04 | OPEN (MEDIUM) | `apps/web/src/lib/parser/xlsx.ts:187-204` serial-date path now has `isValidDayForMonth` check. **CONFIRMED FIXED** — line 197 validates `date.m >= 1 && date.m <= 12 && isValidDayForMonth(date.y, date.m, date.d)`. |
| C67-05 | OPEN (LOW) | `packages/parser/src/xlsx/index.ts:29-47` serial-date path now has `isValidDayForMonth` check. **CONFIRMED FIXED** — line 38 validates `date.m >= 1 && date.m <= 12 && isValidDayForMonth(date.y, date.m, date.d)`. |
| C66-02 | OPEN (MEDIUM) | `cachedCategoryLabels` staleness across redeployments still present. 12 cycles agree. |
| C66-03 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction still present. 10 cycles agree. |
| C66-04 | OPEN (LOW) | `persistToStorage` returns 'corrupted' for non-quota errors still present. 7 cycles agree. |
| C66-05 | OPEN (LOW) | `FALLBACK_CATEGORIES` hardcoded 13 categories vs 40+ in taxonomy. 5 cycles agree. |
| C66-08 | OPEN (LOW) | `formatIssuerNameKo` and `CATEGORY_COLORS` hardcoded maps will drift. 5 cycles agree. |
| C66-10 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between server and web. 4 cycles agree. |

---

## New Findings (This Cycle)

### C68-01: Server-side PDF `isValidShortDate` uses `day <= 31` instead of month-aware validation -- parity bug with web-side
**Severity:** LOW | **Confidence:** HIGH
**File:** `packages/parser/src/pdf/index.ts:24-31`

The server-side PDF parser's `isValidShortDate()` function validates short dates (MM/DD format) using `day <= 31`, while the web-side equivalent at `apps/web/src/lib/parser/pdf.ts:44-51` was upgraded in cycle 65 (C65-01) to use `MAX_DAYS_PER_MONTH` for month-aware day validation. This is a parity bug: the server-side version would accept impossible dates like "2/31" or "4/31" at the pre-filter stage, while the web-side correctly rejects them.

The production `parseDateStringToISO()` in `packages/parser/src/date-utils.ts` catches these invalid dates downstream (since it uses `isValidDayForMonth()`), so no incorrect date output reaches the optimizer. However, the inconsistency means the server-side PDF parser's `findDateCell` may identify rows as "date-containing" that the web-side would correctly skip, leading to slightly different parsing behavior between server and web.

**Concrete failure scenario:** A PDF statement contains a cell like "2/31" in a non-date column (e.g., an installment count column). The server-side `findDateCell` identifies it as a date cell, potentially misidentifying the column structure and producing a transaction with a rejected date string. The web-side `findDateCell` would correctly skip this cell.

**Suggested fix:** Port the `MAX_DAYS_PER_MONTH` table from `apps/web/src/lib/parser/pdf.ts:32` to the server-side PDF parser, and replace `day <= 31` with `day <= (MAX_DAYS_PER_MONTH[month] ?? 0)` at line 30.

### C68-02: Greedy optimizer `scoreCardsForTransaction` creates temporary array per card on every transaction -- O(n) allocation pressure
**Severity:** LOW | **Confidence:** HIGH
**File:** `packages/core/src/optimizer/greedy.ts:133`

Inside `scoreCardsForTransaction()`, line 133 creates a new spread array for every card on every transaction: `[...currentTransactions, transaction]`. For m transactions and n cards, this creates m*n temporary arrays, each copying the current transaction list for that card. Combined with C67-01 (the O(m*n*k) quadratic behavior), this creates significant GC pressure for large statement sets. The temporary array is needed because `calculateCardOutput` must not mutate the assigned transaction list, but an alternative approach (e.g., temporarily pushing then popping) would avoid the allocation.

**Suggested fix:** Instead of spreading a new array, temporarily push the transaction, compute `after`, then pop it:

```ts
currentTransactions.push(transaction);
const after = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
currentTransactions.pop();
```

This avoids creating a new array per card per transaction, reducing GC pressure from O(m*n) allocations to O(1) extra memory.

---

## Cross-File Interaction Analysis

### Server-Web Date Validation Parity
The XLSX serial-date paths on both web-side (C67-04) and server-side (C67-05) now have `isValidDayForMonth()` validation -- both confirmed fixed this cycle. However, the server-side PDF `isValidShortDate` (C68-01) remains inconsistent with the web-side version, creating a parity gap in the PDF table-row detection heuristic.

### Optimizer Performance Compound
The greedy optimizer's O(m*n*k) complexity (C67-01) is compounded by the O(m*n) temporary array allocations (C68-02). For 500 transactions and 600 cards, this produces 300,000 array allocations on top of 300,000 `calculateRewards()` calls. While individually small, the combined effect is noticeable for large inputs.

---

## Final Sweep: Commonly Missed Issues

1. **No new XSS risks found:** All dynamic content flows through Svelte's auto-escaping. No innerHTML usage.

2. **No new secrets/API keys:** All credentials are environment-variable-based.

3. **Error handling robustness:** All async operations in the store are try/catch wrapped with Korean user-facing messages.

4. **Accessibility maintained:** Skip-to-content link present. ARIA labels on interactive elements. Keyboard navigation supported.

5. **Print stylesheet intact:** Dark mode print fix confirmed working.

6. **Session storage persistence:** The `persistToStorage` flow correctly handles quota errors and truncation. The 'corrupted' label for non-quota errors (C66-04) is a known carry-forward.

7. **No new type-safety issues:** All TypeScript compilation passes clean with strict mode.

8. **Test coverage:** vitest (189 pass) and bun test (290 pass) all green.
