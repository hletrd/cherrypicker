# Performance Review — Cycle 2 (2026-04-19)

Reviewer: perf-reviewer angle
Scope: All source files, runtime behavior

---

## Finding C2-P01: `scoreCardsForTransaction` recalculates full card output for every transaction assignment

**File:** `packages/core/src/optimizer/greedy.ts:84-110`
**Severity:** MEDIUM
**Confidence:** High

For each transaction, `scoreCardsForTransaction` calls `calculateCardOutput` twice per card (before and after adding the transaction). This means for N transactions, M cards, and K categories, the total work is O(N * M * K). For typical use cases (< 1000 tx, < 10 cards), this is acceptable.

However, the `calculateCardOutput` call iterates all currently assigned transactions to compute rewards from scratch, making it O(T) where T is the number of assigned transactions so far. This makes the total complexity O(N^2 * M * K).

**Impact:** For 1000 transactions and 10 cards, this results in ~10 million reward calculations. Each is cheap (simple arithmetic), but the constant factor adds up.

**Mitigation:** Already deferred as D-09. No new action needed this cycle.

---

## Finding C2-P02: PDF text extraction creates large string concatenation

**File:** `apps/web/src/lib/parser/pdf.ts:236-244`
**Severity:** LOW
**Confidence:** Medium

The PDF text extraction loop concatenates page text using `fullText += pageText + '\n'`. For large PDFs (100+ pages), this creates O(n^2) string allocations due to JavaScript string immutability.

**Fix:** Use an array and `join('\n')` instead:
```ts
const pages: string[] = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  pages.push(content.items.map(...).join(' '));
}
text = pages.join('\n');
```

---

## Finding C2-P03: `CategoryTaxonomy.findCategory` linear scan on every categorization

**File:** `packages/core/src/categorizer/taxonomy.ts:58-92`
**Severity:** LOW
**Confidence:** High

Already noted in code-reviewer findings. The exact-match lookup uses a `Map.get()` which is O(1), but the substring match iterates all entries. For the current keyword count (~500), this is fine. The `MerchantMatcher.match()` method first checks static keywords (O(n) scan via `Object.entries`) before falling through to taxonomy, so the taxonomy scan is only reached for merchants not in the static keyword list.

**Impact:** Negligible at current scale.

---

## Finding C2-P04: CSV parsing reads entire file into memory

**File:** `apps/web/src/lib/parser/csv.ts:131-241`
**Severity:** LOW
**Confidence:** High

`parseGenericCSV` and all bank adapters split the entire content by newline and process all lines. For very large CSV files (millions of rows), this could cause memory pressure in the browser.

**Mitigation:** Card statement files are typically small (< 10,000 rows). Not a practical concern.

---

## Finding C2-P05: `loadCardsData` fetches the full cards.json on every page load

**File:** `apps/web/src/lib/cards.ts:144-157`
**Severity:** LOW
**Confidence:** High

The `cards.json` file contains all card rules for all issuers. Based on the meta information (683+ cards), this is likely a multi-megabyte JSON file. It's fetched once and cached in a promise, but there's no HTTP cache control visible (depends on server config). If the server doesn't set proper `Cache-Control` headers, the browser will re-fetch on every page load.

**Fix:** Ensure the hosting server sets `Cache-Control: public, max-age=86400` for `data/cards.json`, or use a service worker for caching.

---

## Finding C2-P06: `analyzeMultipleFiles` sorts all transactions twice

**File:** `apps/web/src/lib/analyzer.ts:198-235`
**Severity:** LOW
**Confidence:** Low

Transactions are sorted by date on line 198 (`allTransactions.sort(...)`) and then dates are sorted again on lines 230 and 235 for computing statement periods. The second sorts are on smaller arrays (date strings only), so the overhead is minimal. Not worth optimizing.
