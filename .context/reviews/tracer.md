# Cycle 32 Tracer Review — cherrypicker

**Reviewer:** tracer (sonnet)
**Scope:** Data-flow tracing, execution-path analysis, cross-file interactions, state propagation
**Date:** 2026-05-06
**Files examined:** 27 source files across packages/core, packages/parser, apps/web/src/lib/parser, apps/web/src/lib

---

## Executive Summary

Traced 8 critical data flows. Found 3 confirmed issues (1 High, 2 Medium), 3 likely issues requiring validation, and 2 latent risks. The most severe is a forward-fill state leak in the XLSX parser that can propagate incorrect data across sections. Several dead-code paths exist due to incomplete feature wiring (`isOnline`).

---

## Confirmed Issues

### Issue 1: XLSX Parser Forward-Fill State Leak Across Blank Rows [HIGH]

**Confidence:** High
**Files:** `apps/web/src/lib/parser/xlsx.ts:480`, `apps/web/src/lib/parser/html.ts:163-173`

**Trace:**
```
parseXLSXSheet → row loop → blank row check → continue (NO state reset)
```

**Evidence:**
- `xlsx.ts:480`: `if (row.every((c) => !c)) continue;` — blank rows are skipped but `lastDate`, `lastMerchant`, `lastAmount`, etc. are NOT reset.
- `html.ts:163-173`: The HTML parser correctly resets all forward-fill state on blank rows.
- This inconsistency means if a Korean bank XLSX export has multiple data sections separated by blank rows (e.g., monthly grouping), values from the first section forward-fill into the second.

**Concrete failure scenario:**
1. Section A ends with date=2024-01-15, merchant="스타벅스", amount=5000
2. Blank row(s) separate sections
3. Section B begins with a merged cell where date is empty (intended to inherit from Section B's header)
4. XLSX parser forward-fills date=2024-01-15, merchant="스타벅스" from Section A into Section B's first transaction
5. User sees phantom transactions with wrong merchant/date assignments

**Fix:** Add forward-fill state reset on blank rows in `parseXLSXSheet`, matching the HTML parser pattern:
```typescript
if (row.every((c) => !c)) {
  lastDate = lastMerchant = lastCategory = lastInstallments = lastMemo = lastAmount = '';
  continue;
}
```

---

### Issue 2: `isOnline` Field Never Populated — Dead Code Path [MEDIUM]

**Confidence:** High
**Files:** All parsers (csv.ts, xlsx.ts, pdf.ts, html.ts, json.ts, ofx.ts), `packages/core/src/calculator/reward.ts:36-51`

**Trace:**
```
Parser (any) → RawTransaction → CategorizedTx → CategorizedTransaction → ruleConditionsMatch
```

**Evidence:**
- `RawTransaction` type in `apps/web/src/lib/parser/types.ts` does NOT include `isOnline`.
- `CategorizedTx` in `analyzer.ts:91-103` has `isOnline?: boolean` but is never set during categorization.
- `optimizeFromTransactions` maps CategorizedTx to CategorizedTransaction at line 179-191, passing through `isOnline` (always undefined).
- `ruleConditionsMatch` in `reward.ts:36-51` checks `rule.conditions?.excludeOnline && tx.isOnline` — since `isOnline` is always undefined, this condition is always false.
- Result: `excludeOnline` rules are NEVER excluded. Cards with online-exclusion conditions (e.g., "5% offline only") will incorrectly count online transactions.

**Concrete failure scenario:**
1. User has a card with rule: category="dining", excludeOnline=true, rate=5%
2. User makes an online delivery order (e.g., 배달의민족) categorized as "dining"
3. Optimizer assigns this transaction to the offline-only card
4. User would not actually receive the 5% reward because the transaction was online
5. Optimizer overestimates rewards

**Fix:** Either (a) remove `excludeOnline` from the rule schema and calculator since it's unimplemented, or (b) add online merchant detection to the categorizer (e.g., match merchants containing "배달", "온라인", "쿠팡", etc.) and wire it through.

---

### Issue 3: Web-Side Encoding Detection Missing UTF-16 [MEDIUM]

**Confidence:** High
**Files:** `apps/web/src/lib/parser/index.ts:26-62`, `packages/parser/src/detect.ts:9-47`

**Trace:**
```
parseFile (web) → buffer.arrayBuffer() → TextDecoder with utf-8/cp949 only
parseStatement (server) → detectEncoding → handles UTF-16 LE/BE BOM
```

**Evidence:**
- Server-side `detectEncoding` (`packages/parser/src/detect.ts:9-47`) checks for UTF-16 LE BOM (`0xFF 0xFE`) and UTF-16 BE BOM (`0xFE 0xFF`) and returns `'utf-16le'` / `'utf-16be'`.
- Web-side `parseFile` (`apps/web/src/lib/parser/index.ts:26-62`) only tries `['utf-8', 'cp949']` encodings. UTF-16 files produce replacement characters and fail silently.
- Korean bank CSV exports occasionally use UTF-16 (especially older Windows systems with "Unicode" export option).

**Concrete failure scenario:**
1. User exports statement from an older Korean bank system using UTF-16 LE
2. Web app detects format=csv, tries utf-8 → many replacement characters (�)
3. If replacements > 50, a warning is shown: "파일 인코딩을 정확히 감지하지 못했어요"
4. Merchant names are corrupted (e.g., "현대카드" → "������")
5. Categorization fails, optimization produces garbage results

**Fix:** Add UTF-16 BOM detection to the web-side `parseFile` before the utf-8/cp949 trial:
```typescript
const buffer = await file.arrayBuffer();
const arr = new Uint8Array(buffer);
if (arr.length >= 2 && arr[0] === 0xFF && arr[1] === 0xFE) {
  // UTF-16 LE — decode directly
  content = new TextDecoder('utf-16le').decode(buffer);
} else if (arr.length >= 2 && arr[0] === 0xFE && arr[1] === 0xFF) {
  content = new TextDecoder('utf-16be').decode(buffer);
} else {
  // existing utf-8/cp949 trial
}
```

---

## Likely Issues (Require Manual Validation)

### Issue 4: OFX Amount Sign Semantics Divergence from Server [LIKELY]

**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/ofx.ts:136-144`, `packages/parser/src/ofx/index.ts` (inferred)

**Trace:**
```
OFX block → extractTag('TRNAMT') → parseOFXAmount → sign check → RawTransaction
```

**Evidence:**
- `ofx.ts:136-144`: `const rawAmount = parseOFXAmount(trnAmt); if (rawAmount >= 0) continue; const amount = Math.abs(rawAmount);`
- This means ONLY negative OFX amounts become transactions (positive amounts are skipped as "credits").
- The comment says: "In OFX: negative = charges, positive = credits".
- However, some banks may use the opposite convention, or users may want to see credits/refunds in their analysis.
- The server-side parser may have different behavior (not directly examined, but the tracer.md from cycle 20 noted a divergence).
- More importantly: the web-side `parseOFXAmount` delegates to `parseAmountString` which handles full-width digits, but the server-side may use `parseFloat` directly.

**Validation needed:** Test with actual OFX files from multiple Korean banks to confirm sign convention consistency.

---

### Issue 5: `previousMonthSpendingOption` Staleness on Cross-Month Edits [LIKELY]

**Confidence:** Medium
**Files:** `apps/web/src/lib/store.svelte.ts:560-586`, `apps/web/src/lib/analyzer.ts:364-369`

**Trace:**
```
User loads old analysis → edits category for transaction in Month M-1 → reoptimize → uses stale previousMonthSpendingOption
```

**Evidence:**
- `store.svelte.ts:560-586`: `previousMonthSpending` is computed. If `snapshot.previousMonthSpendingOption !== undefined`, it uses that cached value instead of recomputing from edited transactions.
- This is intentional per C44-01: "Preserve the user's explicit input across reoptimize calls so that category edits don't silently change the performance tier baseline."
- BUT: if the user originally analyzed in Month M (with M-1 spending = X), then comes back weeks later and edits a transaction in Month M-1, the reoptimize still uses the old X value even though Month M-1 spending may have changed due to edits.
- The user's explicit choice from weeks ago may no longer be relevant.

**Concrete failure scenario:**
1. User analyzes January statement on Jan 15, manually inputs previousMonthSpending=500000
2. User returns on Feb 20, notices a miscategorized December transaction, edits it
3. Reoptimize runs with previousMonthSpendingOption=500000 (stale)
4. But the December edit changed the actual previous month spending; the user's old manual input is now wrong
5. Optimizer uses incorrect performance tier baseline

**Fix:** Add a timestamp or "analysis generation" check. If the stored `previousMonthSpendingOption` is older than the most recent edit to transactions from the previous month, recompute instead of using the stale value.

---

### Issue 6: Greedy Optimizer Quadratic Complexity [LIKELY / RISK]

**Confidence:** Medium
**Files:** `packages/core/src/optimizer/greedy.ts:39-66`, `packages/core/src/optimizer/greedy.ts:198-233`

**Trace:**
```
greedyOptimize → for each transaction → scoreCardsForTransaction → for each card → calculateCardOutput (2 calls) → calculateRewards (iterates all card transactions)
```

**Evidence:**
- For T transactions and C cards, `scoreCardsForTransaction` is called T times.
- Each call iterates over C cards.
- For each card, it calls `calculateCardOutput` twice (before and after adding the transaction).
- Each `calculateCardOutput` calls `calculateRewards`, which iterates over all currently assigned transactions for that card.
- In the worst case, card 1 gets transactions 1, 2, 3... so the kth transaction for card 1 triggers an O(k) inner loop.
- Total complexity: O(T * C * T) = O(T² * C).
- For 1000 transactions and 100 cards: ~100M iterations inside `calculateRewards`.

**Impact:** The web app is client-side; 1000 transactions × 100 cards could cause noticeable UI freezing (multiple seconds).

**Fix:** Consider memoization or incremental reward calculation. The marginal reward for adding a transaction to a card could be computed incrementally without re-scanning all previous transactions.

---

## Latent Risks

### Risk 1: HTML Parser Normalization Double-Encoding

**Confidence:** Low
**Files:** `apps/web/src/lib/parser/html.ts:59-61`

**Trace:**
```
parseHTML → normalizeHTML → TextEncoder.encode → xlsx.read(type='array')
```

**Evidence:**
- `html.ts:59`: `const encoder = new TextEncoder(); workbook = xlsx.read(encoder.encode(normalized), { type: 'array' });`
- `TextEncoder` always produces UTF-8. If the original HTML was EUC-KR or CP949, `normalizeHTML` processes it as a JavaScript string (already decoded), then re-encodes as UTF-8. This is correct behavior.
- However, if `normalizeHTML` strips content that affects character boundaries (e.g., multi-byte sequences in comments), the re-encoded output could be corrupted.
- No confirmed failure scenario; marked as latent risk.

---

### Risk 2: JSON Parser Wrapper Key Case-Sensitivity Mismatch

**Confidence:** Low
**Files:** `apps/web/src/lib/parser/json.ts:177-194`

**Trace:**
```
parseJSON → wrapper key search → case-insensitive match on lowercased keys
```

**Evidence:**
- Wrapper keys include `'transactionList'` and `'transaction_list'`.
- The search first checks exact case (`obj[key]`), then falls back to case-insensitive comparison.
- If a JSON payload has BOTH `'transactionList'` (array) and `'transactionList'` (string), the first match wins.
- If a payload has `'TransactionList'` (capital T), the case-insensitive fallback finds it.
- No known bug, but the precedence is: exact match > case-insensitive match > next wrapper key. This could be surprising if `data` (exact) matches a non-array before `TransactionList` (case-insensitive) matches the actual array.

---

## Cross-File Interaction Audit

### Parser → Analyzer Data Contract

| Field | Parser Sets | Analyzer Reads | Notes |
|-------|------------|----------------|-------|
| date | Yes (all) | Yes | Validated via isValidISODate |
| merchant | Yes (all) | Yes | Used for categorization |
| amount | Yes (all) | Yes | Filtered > 0 in optimizer |
| installments | Yes (CSV/XLSX/PDF) | Yes | Optional |
| category | Yes (some) | Yes (as rawCategory) | Used as weak signal |
| memo | Yes (some) | Yes | Display only |
| isOnline | **NO** | Yes (dead code) | **See Issue 2** |
| currency | **NO** | Hardcoded to KRW | Safe for Korean market |

### Store State Flow

```
FileUpload → parseFile → parseAndCategorize → analyzeMultipleFiles
    ↓
    result (AnalysisResult) → persistToStorage (sessionStorage)
    ↓
    User edits category → reoptimize → optimizeFromTransactions
    ↓
    result updated → persistToStorage
```

**Validation:** The `snapshot` pattern in `reoptimize` (line 520) correctly prevents reactive state mutation during async gaps. The `generation` counter correctly triggers Svelte reactivity. SessionStorage persistence handles truncation gracefully.

### Cache Invalidation Audit

| Cache | Location | Invalidation | Risk |
|-------|----------|-------------|------|
| cachedCoreRules | analyzer.ts:58 | invalidateAnalyzerCaches() | Correct — reset on store.reset() |
| cachedCategoryLabels | store.svelte.ts:401 | Reset on store.reset() | Correct — doesn't cache empty |
| MerchantMatcher.cache | matcher.ts:32 | LRU eviction at 500 | Correct — per-instance |
| cardsPromise | cards.ts:94 | Reset on AbortError | Correct |
| categoriesPromise | cards.ts:96 | Reset on AbortError | Correct |
| cardIndex | cards.ts:101 | Cleared on error | Correct |

---

## Final Sweep Checklist

1. ✅ No circular data flows detected
2. ✅ All async flows properly propagate errors (try/catch at every entry point)
3. ✅ No unhandled promise rejections in traced paths
4. ✅ State mutations centralized in store.svelte.ts
5. ❌ XLSX forward-fill state leak (Issue 1)
6. ❌ Dead code path for isOnline (Issue 2)
7. ❌ Web encoding gap for UTF-16 (Issue 3)
8. ✅ All parsers normalize amounts consistently (via parseAmount/parseAmountString)
9. ✅ Date validation is consistent across all parsers (parseDateStringToISO + isValidISODate)
10. ✅ Error objects enriched with line numbers and raw text where applicable

---

## Verdict

**FIX BEFORE SHIP:** Issue 1 (XLSX forward-fill leak) — data integrity risk.
**FIX RECOMMENDED:** Issue 2 (isOnline dead code) — either implement or remove to prevent incorrect optimization.
**FIX RECOMMENDED:** Issue 3 (UTF-16 encoding gap) — affects compatibility with older bank exports.
**VALIDATE:** Issues 4-6 require testing with real data to confirm severity.
