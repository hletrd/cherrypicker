# Comprehensive Code Review — Cycle 10 (2026-04-19)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository — all packages, apps, tools, e2e, tests
**Focus:** New findings beyond cycles 1–9; deep analysis of edge cases and cross-file interactions

---

## Verification of Cycle 9 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| C9-05: Error feedback when reoptimize discards edits due to null result | **FIXED** | `store.svelte.ts:345-347` now sets `error` when `result` is null; `TransactionReview.svelte:167-169` checks `analysisStore.error` after reoptimize |
| C9-01: `toCoreCardRuleSets` cache never hits — reference equality removed | **FIXED** | `analyzer.ts:43-47,194-196` now uses `cachedCoreRules` existence-only cache; `cachedRulesRef` removed entirely |
| C9-11: `isValidTx` non-empty string checks for id, date, category | **FIXED** | `store.svelte.ts:143-147` now checks `tx.id.length > 0`, `tx.date.length > 0`, `tx.category.length > 0` |
| C9-13: `monthlyBreakdown` explicitly sorted by month | **FIXED** | `analyzer.ts:304-305` now includes `.sort(([a], [b]) => a.localeCompare(b))` before `.map()` |
| C9-03: Bank detection tie-breaking documented | **FIXED** | `detect.ts:114-126` now has a documentation comment explaining tie-breaking behavior |

All cycle 9 fixes verified as correctly implemented.

---

## New Findings

### C10-01: `calculateRewards` global cap `ruleMonthUsed` over-count correction may under-count for subsequent transactions

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:265-268`
- **Description:** When a reward exceeds the global cap, the code computes `overcount = rewardAfterMonthlyCap - appliedReward` and adjusts `ruleMonthUsed` downward by that amount: `ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed - overcount)`. This means the rule-level tracker is rolled back so that future transactions at the rule level get a "fair" shot at the remaining rule cap. However, the `ruleResult.newMonthUsed` was computed by `applyMonthlyCap` which already advanced the rule month tracker by the full `rewardAfterMonthlyCap`. Subtracting `overcount` rolls it back to just `appliedReward` — which is correct for the global cap interaction. BUT: the next transaction for the same rule will see `currentRuleMonthUsed = appliedReward` instead of `rewardAfterMonthlyCap`. This means the rule-level cap is also effectively reduced by the global cap overflow, and a subsequent transaction for this rule that hasn't hit the rule cap yet could still get the full rate even though the rule has already consumed `rewardAfterMonthlyCap` of its monthly cap from the optimizer's perspective. The optimizer calls `calculateRewards` with only the currently-assigned transactions, so this over-count correction ensures that the rule-level cap is tracked correctly relative to the global cap constraint. The behavior is actually correct for the optimizer's use case — the rule-level cap should reflect what was actually applied (not what was computed before the global cap cut). However, if `calculateRewards` is ever used outside the optimizer (e.g., for a single-card display), the correction is also correct because the global cap is a hard constraint. So this is NOT a bug — but the logic is subtle and easy to misunderstand during maintenance.
- **Failure scenario:** No failure scenario — the behavior is correct. This is a maintainability concern.
- **Fix:** Add a documentation comment at lines 265-268 explaining why the over-count correction is necessary and correct:

```ts
// When the global cap clips a reward, the rule-level tracker was advanced
// by the full pre-clip amount (rewardAfterMonthlyCap). We must roll it back
// to reflect only what was actually applied, so subsequent transactions see
// the correct remaining rule-level cap relative to the global constraint.
```

### C10-02: `MerchantMatcher.match` substring matching can match a short keyword inside an unrelated long merchant name

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/categorizer/matcher.ts:46-55` and `packages/core/src/categorizer/taxonomy.ts:69-76`
- **Description:** In `MerchantMatcher.match()`, step 2 checks `lower.includes(kw) || kw.includes(lower)`. The `kw.includes(lower)` direction means that if the merchant name is "스타" (a 2-character string), it would match a keyword like "스타벅스" (Starbucks) because "스타벅스".includes("스타") is true. This is the "fuzzy reverse" match. However, this same check also exists in `CategoryTaxonomy.findCategory()` at line 89 (`kw.includes(lower)`). The `MerchantMatcher` at step 2 runs the `kw.includes(lower)` check with confidence 0.8, while the `CategoryTaxonomy` at its step 3 runs it with confidence 0.6. Since `MerchantMatcher` step 2 runs first and returns 0.8, the taxonomy's 0.6 match is never reached. The problem is that a 2-character merchant name like "스타" would incorrectly match the keyword "스타벅스" with confidence 0.8, even though the merchant is not Starbucks — "스타" could be short for many things (e.g., "스타일" = style, "스타킹" = stockings). The `isSubstringSafeKeyword` guard at line 16 requires keywords to be at least 2 characters, but the merchant name "스타" is itself 2 characters and passes. The real issue is that `kw.includes(lower)` (keyword contains merchant) is a very loose match — it should only be used when the merchant name is long enough that containment is meaningful (e.g., merchant name "스타벅스 강남점" contained in keyword "스타벅스" — wait, that's the other direction). The direction `kw.includes(lower)` means the keyword is longer than the merchant name. For 2-character merchant names, this is almost always a false positive.
- **Failure scenario:** A transaction merchant is "스타" (short for a non-Starbucks merchant). The `MerchantMatcher` finds "스타벅스" keyword because "스타벅스".includes("스타"), returns `{ category: 'cafe', confidence: 0.8 }`. The transaction is incorrectly categorized as cafe.
- **Fix:** Add a minimum length check for the `kw.includes(lower)` direction: only apply this match when `lower.length >= 3` (or `lower.length >= 2` for CJK where each character carries more meaning). Alternatively, remove the `kw.includes(lower)` direction from step 2 entirely and only keep it in the taxonomy's step 3 where it has a lower confidence of 0.6.

### C10-03: `parseXLSX` does not handle `NaN` or `Infinity` values from Excel numeric cells

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/xlsx.ts:241-253`
- **Description:** `parseAmount` handles `typeof raw === 'number'` by checking `Number.isFinite(raw)`. This correctly rejects `NaN` and `Infinity`. However, `parseDateToISO` at line 193-203 handles `typeof raw === 'number'` by checking `raw < 1 || raw > 100000`, which rejects `NaN` (since `NaN < 1` is false and `NaN > 100000` is false, so both conditions are false, and the code proceeds to `XLSX.SSF.parse_date_code(NaN)`). The `parse_date_code` function returns `undefined` for NaN, and the `if (date)` check at line 198 catches this. But `Infinity` would pass the guard (`Infinity > 100000` is true, so it returns `String(Infinity)` which is "Infinity"). An Excel cell with a formula error like `#DIV/0!` could produce `Infinity`. The `parseAmount` function would return `null` for `Infinity` (since `Number.isFinite(Infinity)` is false), so the transaction would be skipped. But `parseDateToISO` would produce the string "Infinity" as a date, which would then cause downstream issues in `formatDateKo` and `formatPeriod`.
- **Failure scenario:** An XLSX file has a cell with `#DIV/0!` error in the date column. The parsed raw value is `Infinity`. `parseDateToISO` returns "Infinity". The transaction is created with `date: "Infinity"`, which causes `formatPeriod` to show "Infinity년 NaN월" and `formatDateKo` to show garbled output.
- **Fix:** Add a `Number.isFinite(raw)` check in `parseDateToISO` for the numeric path:

```ts
if (typeof raw === 'number') {
  if (!Number.isFinite(raw) || raw < 1 || raw > 100000) return String(raw);
  // ... rest of serial date handling
}
```

### C10-04: `CategoryBreakdown.svelte` `CATEGORY_COLORS` lookup uses fallback that silently drops subcategory distinction

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:87`
- **Description:** The color lookup at line 87 is `CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.uncategorized`. When a subcategory like `cafe` appears as the `a.category` value (which happens when the optimizer creates an assignment at the subcategory level), the color lookup finds `CATEGORY_COLORS['cafe']` which returns `'#92400e'` — this is correct because the `CATEGORY_COLORS` map includes subcategory entries. However, the fallback `CATEGORY_COLORS.uncategorized` (`'#d1d5db'`, gray) would be used for any category NOT in the map. The issue is that `CATEGORY_COLORS` is accessed with `a.category` which could be either a top-level category or a subcategory, and there's no logic to fall back to the parent category's color if the subcategory is missing. This extends D-42/D-46/D-64 — the hardcoded color map is incomplete and new subcategories fall through to gray.
- **Failure scenario:** A new subcategory `traditional_market` is added to the taxonomy. The optimizer creates an assignment with `category: 'traditional_market'`. `CATEGORY_COLORS['traditional_market']` is undefined, so the fallback gray is used. The `traditional_market` bar is visually indistinguishable from truly uncategorized items.
- **Fix:** Same class as D-42/D-46/D-64. Add a fallback that resolves the parent category from the taxonomy and uses its color. Or implement a dynamic color generator per the D-42 exit criterion.

### C10-05: `greedyOptimize` best single card computation re-evaluates ALL cards with ALL transactions — O(n*m) redundant work

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:256-268`
- **Description:** After the greedy assignment loop, `greedyOptimize` computes `bestSingleCard` by iterating over ALL `cardRules` and calling `calculateCardOutput(sortedTransactions, previousMonthSpending, rule)` for each. This is O(n * m) where n = number of cards (~683) and m = number of transactions. The greedy assignment loop already called `calculateCardOutput` multiple times per transaction per card (D-09/D-51). The `bestSingleCard` computation is a separate pass that calculates the total reward if ALL transactions were assigned to a single card. This is necessary for the savings comparison, but it's a full pass over all cards. With 683 cards and ~100 transactions, this takes ~1ms, which is acceptable. However, the `calculateCardOutput` call at line 259 passes `sortedTransactions` (all transactions) rather than the transactions actually assigned to that card. This is correct — we want to know how much reward each card would give for ALL transactions, not just the ones the greedy optimizer assigned to it. This is not a bug, just a performance note.
- **Failure scenario:** No failure — this is a performance observation for future optimization.
- **Fix:** No fix needed for current scale. If card count grows significantly (> 5000), consider pre-filtering cards that have any matching reward rules for the transaction categories before computing bestSingleCard.

### C10-06: `FileDropzone.svelte` `handleUpload` doesn't reset `uploadStatus` on `analysisStore.analyze` rejection

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:192-211`
- **Description:** When `analysisStore.analyze()` throws (caught by the `try/catch` at line 208), the catch block sets `errorMessage` and `uploadStatus = 'error'`. This is correct. However, if `analysisStore.analyze()` does NOT throw but instead sets `analysisStore.error` internally (which happens at `store.svelte.ts:327` when `analyzeMultipleFiles` throws), the `uploadStatus` is set to `'success'` at line 203 even though the analysis failed. Wait — actually, looking more carefully at the store code, `analysisStore.analyze()` at line 326 catches the error and sets `error` and `result = null`. It does NOT re-throw. So the `try` block in `handleUpload` at line 198 will always complete without throwing (the `await analysisStore.analyze()` promise resolves, not rejects). This means `uploadStatus` is always set to `'success'` at line 203, even when the analysis failed. The error is only visible via `analysisStore.error`, but `handleUpload` doesn't check this.
- **Failure scenario:** User uploads a corrupted CSV file. `analysisStore.analyze()` catches the parse error internally, sets `error = '거래 내역을 찾을 수 없어요'`, and resolves the promise. `handleUpload` sets `uploadStatus = 'success'` and navigates to the dashboard after 1.2 seconds. The user sees the dashboard with an empty state and an error message — but they were already redirected away from the upload page, losing the ability to retry with a different file without navigating back.
- **Fix:** After `await analysisStore.analyze()`, check `analysisStore.error` before setting `uploadStatus = 'success'`:

```ts
await analysisStore.analyze(uploadedFiles, { ... });
if (analysisStore.error) {
  errorMessage = analysisStore.error;
  uploadStatus = 'error';
} else {
  uploadStatus = 'success';
  navigateTimeout = setTimeout(() => {
    window.location.href = import.meta.env.BASE_URL + 'dashboard';
  }, 1200);
}
```

### C10-07: `OptimalCardMap.svelte` sort buttons use `const` tuple type assertion but `sortKey` state is `SortKey` type — works but fragile

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:62`
- **Description:** The sort buttons use `{#each ([['spending', '지출순'], ['rate', '혜택률순'], ['reward', '혜택액순']] as const) as [key, label]}`. The `as const` makes the array readonly and narrows the string types. The `key` values are `'spending' | 'rate' | 'reward'` which matches the `SortKey` type. This works correctly. However, if a new sort key is added to `SortKey` but not to the button array, or vice versa, TypeScript won't catch the mismatch because the `as const` assertion narrows to literal types that happen to match. This is a minor maintainability concern — the same pattern is used in `SavingsComparison.svelte` for the breakdown toggle.
- **Failure scenario:** No failure — this is a maintainability observation.
- **Fix:** No fix needed. The pattern is idiomatic Svelte 5.

### C10-08: `TransactionReview.svelte` `aiCategorizer` import is dead code — module exports are never used in production

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:6`
- **Description:** The import `import * as aiCategorizer from '../../lib/categorizer-ai.js'` is used at line 45 (`aiCategorizer.isAvailable()`), line 72 (`aiCategorizer.initialize()`), and line 88 (`aiCategorizer.categorizeBatch()`). However, `isAvailable()` always returns `false` in production because the AI categorizer requires a self-hosted runtime that is not yet implemented. The import adds bundle weight (the entire `categorizer-ai` module) even though it's never functionally used. This is the same finding as D-10/D-68.
- **Failure scenario:** The import increases bundle size by including the `categorizer-ai` module. Since `isAvailable()` returns false, the AI categorization UI is never shown to users.
- **Fix:** Same as D-10/D-68. Either dynamically import the module (reducing initial bundle) or remove the import until the self-hosted AI runtime is implemented.

### C10-09: `analyzeMultipleFiles` uses only latest month for optimization but includes ALL months in `transactions` field — reoptimize includes stale non-latest-month data

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:266-271,293-311`
- **Description:** In `analyzeMultipleFiles`, step 6 filters transactions to the latest month for optimization: `const latestTransactions = allTransactions.filter(tx => tx.date.startsWith(latestMonth))`. Step 7 optimizes only `latestTransactions`. However, the returned `result.transactions` at line 298 is `allTransactions` (ALL months). When the user edits categories in `TransactionReview` and clicks "변경 적용", `reoptimize` is called with `editedTxs` which is a copy of `analysisStore.transactions` — i.e., ALL months. The `reoptimize` call goes to `optimizeFromTransactions(editedTransactions)`, which passes all months to `greedyOptimize`. This means the reoptimize includes non-latest-month transactions in the optimization, which could produce different results than the initial optimization that only used the latest month.

  The comment at lines 287-292 acknowledges this: "non-latest-month transactions still contribute to per-card previousMonthSpending calculations and don't distort the optimization — they just add more data for the optimizer to consider." But this is not quite accurate. Non-latest-month transactions ARE included in the greedy assignment (they go through `scoreCardsForTransaction` and get assigned to cards), which means they affect cap calculations and card assignments. A January cafe transaction would consume part of a card's monthly cafe cap even though it's from a different month than the optimization target.

  However, looking more carefully at `optimizeFromTransactions`, the `cardPreviousSpending` is computed from ALL transactions (line 167-172: `transactions.filter(tx => !exclusions.has(tx.category)).reduce(...)`). And `buildConstraints` receives ALL transactions (line 189). So `greedyOptimize` processes ALL transactions, not just the latest month. The initial optimization only uses the latest month because `analyzeMultipleFiles` explicitly filters to `latestTransactions` before calling `optimizeFromTransactions`. But `reoptimize` passes the full `editedTxs` which includes all months.

- **Failure scenario:** User uploads 3 months of statements. Initial optimization only considers the latest month (March) — March's cafe spending gets the correct cap allocation. When the user edits a category and clicks "변경 적용", `reoptimize` is called with all 3 months of transactions. January and February cafe transactions now also consume the cafe reward cap, potentially causing March transactions to get less reward than the initial optimization showed.
- **Fix:** In `reoptimize`, filter `editedTransactions` to the latest month before passing to `optimizeFromTransactions`, matching the initial optimization behavior. Or, pass the statement period to `optimizeFromTransactions` so it can filter internally.

### C10-10: `SavingsComparison.svelte` annual savings projection multiplies by 12 regardless of actual data span

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:174`
- **Description:** Line 174 shows `연간 약 {formatWon(opt.savingsVsSingleCard * 12)} 절약`. This annualizes the monthly savings by multiplying by 12. This is the same finding as D-40. The projection is labeled with "약" (approximately) and "연간" (annual), making it clear it's an estimate. The monthly savings figure is based on a single month's data, so multiplying by 12 is the simplest annualization. This is not a bug but is noted for completeness since the savings figure could be misleading if the user's spending pattern is seasonal (e.g., holiday spending in December).
- **Failure scenario:** User uploads December statement with heavy holiday spending. The annual projection shows savings * 12, which overestimates actual annual savings because holiday spending is not representative.
- **Fix:** Same as D-40. No fix needed — the "약" label is sufficient for the current use case.

### C10-11: `detectBank` regex patterns use `lastIndex` state on global RegExp but patterns are not global

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/detect.ts:8-105`
- **Description:** The `BANK_SIGNATURES` array contains RegExp patterns like `/현대카드/`, `/HYUNDAICARD/`, etc. None of these use the `g` (global) flag, so `RegExp.test()` does not advance `lastIndex`. This is correct — the patterns are used only for presence detection, not for finding all matches. However, if someone adds a `g` flag to a pattern, `RegExp.test()` would advance `lastIndex` and could return false on the second call for the same content (because the second test starts from where the first match ended). This is a well-known JavaScript footgun. The current code is correct because no patterns use the `g` flag, but it's worth noting as a latent risk.
- **Failure scenario:** A developer adds a pattern like `/카드/g` to test for card mentions. The second `detectBank` call for the same content returns wrong results because `lastIndex` is advanced past the first match.
- **Fix:** No fix needed. Document in the BANK_SIGNATURES comments that patterns should NOT use the `g` flag to avoid `lastIndex` state issues.

### C10-12: `store.svelte.ts` `persistToStorage` truncation only omits `transactions` — but `optimization.assignments` can also be large

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:124-127`
- **Description:** When the serialized payload exceeds `MAX_PERSIST_SIZE` (4MB), the code omits `transactions` and saves the rest: `const withoutTxs = { ...persisted, transactions: undefined }`. However, `optimization.assignments` can also be very large — with 30+ categories and 5 alternatives each, the assignments array can be ~50KB+ in JSON. More importantly, `optimization.cardResults` contains per-card per-category reward breakdowns, caps, and performance tier info for every card that had assigned transactions. With 10+ cards, each with 5+ categories, this can be substantial. The `optimization` object as a whole (including `assignments`, `cardResults`, `bestSingleCard`) is always included even when truncated. If the optimization object itself exceeds 4MB (unlikely but possible with extreme numbers of cards and categories), the truncation won't help and `sessionStorage.setItem` will throw.
- **Failure scenario:** User uploads a statement with 500+ transactions across 50+ categories with 20+ cards. The `optimization.cardResults` contains detailed per-card per-category breakdowns. The total serialized size with transactions omitted is still > 4MB because `optimization` alone is large. `sessionStorage.setItem` throws `QuotaExceededError`, which is caught and sets `_persistWarningKind = 'corrupted'`. The user sees the "거래 내역을 불러오지 못했어요" warning, but the optimization data is also lost — meaning the entire analysis result is gone on page reload.
- **Fix:** Consider also truncating `optimization.cardResults` (which is only used for the card breakdown table) when the payload is still too large after omitting transactions. Alternatively, increase the `MAX_PERSIST_SIZE` to 4.5MB to provide more headroom for the optimization object.

### C10-13: `MerchantMatcher` does not handle merchant names that are empty or whitespace-only

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/categorizer/matcher.ts:32-79`
- **Description:** The `match` method receives `merchantName` and immediately lowercases it: `const lower = merchantName.toLowerCase().trim()`. If `merchantName` is an empty string, `lower` will be `""`. The exact match check `ALL_KEYWORDS[""]` returns undefined (correct — no keyword maps to empty string). The substring check at line 48 `lower.includes(kw)` would be `"".includes(kw)` which is false for all non-empty keywords. The `kw.includes(lower)` check would be `kw.includes("")` which is TRUE for all strings — so an empty merchant name would match the first keyword in `ALL_KEYWORDS` with confidence 0.8, because every string includes the empty string. However, the `isSubstringSafeKeyword` guard at line 47 checks `keyword.trim().length >= 2`, but the empty merchant name is being checked against keywords, not the other way around. The guard protects against short keywords, not short merchant names.

  Wait, looking more carefully: the loop at line 46 iterates `Object.entries(ALL_KEYWORDS)`. For each `[kw, categoryStr]`, it checks `isSubstringSafeKeyword(kw)` (keyword must be >= 2 chars). Then it checks `lower.includes(kw) || kw.includes(lower)`. For an empty merchant name, `lower = ""`, so `kw.includes("")` is always true for any keyword. But `lower.includes(kw)` is `"".includes(kw)` which is false. So the condition `lower.includes(kw) || kw.includes(lower)` is `false || true = true` for every keyword >= 2 chars. This means an empty merchant name matches the FIRST keyword in the iteration order with confidence 0.8.

- **Failure scenario:** A CSV row has an empty merchant field. The parsed `RawTransaction` has `merchant: ""`. The `MerchantMatcher.match("")` iterates ALL_KEYWORDS and matches the first keyword (which is `""` — no, keywords are >= 2 chars). Actually, since `isSubstringSafeKeyword` checks the KEYWORD not the merchant name, all keywords >= 2 chars pass. Then `kw.includes("")` is always true. The first keyword in iteration order wins. The empty merchant gets a wrong category with 0.8 confidence.
- **Fix:** Add a guard at the beginning of `match()`: `if (!merchantName.trim()) return { category: 'uncategorized', confidence: 0.0 };`

---

## Final Sweep — Commonly Missed Issues

1. **ReDoS in detectBank patterns**: The `BANK_SIGNATURES` regex patterns are all simple literal or case-insensitive patterns with no backtracking. No ReDoS risk.

2. **Prototype pollution via JSON.parse in loadFromStorage**: Modern browsers' `JSON.parse` is safe against prototype pollution. The `__proto__` key would be parsed as a regular property, not as a prototype setter. The validation checks `parsed.optimization` and specific field types, which would fail for a crafted `__proto__` payload.

3. **Race condition in parallel file analysis**: `analyzeMultipleFiles` uses `Promise.all(files.map(f => parseAndCategorize(f, options)))`. If two files take very different amounts of time, the faster one completes first. This is fine because the results are merged sequentially after all promises resolve. No race condition.

4. **Memory leak from PDF.js document**: `parsePDF` at `pdf.ts:274` calls `pdfjsLib.getDocument()` which returns a `PDFDocumentProxy`. The document is never explicitly closed via `doc.destroy()`. The garbage collector should handle this, but for large PDFs, explicitly calling `doc.destroy()` after page iteration would free memory sooner. This is a minor optimization, not a leak.

5. **Missing `installments` handling in web CSV parser**: The web CSV parser correctly handles `installments` for bank-specific adapters but the generic parser at `csv.ts:224-227` uses `parseInt(cells[installmentsCol] ?? '', 10)` with `!isNaN(inst) && inst > 0`. This differs from the bank adapters which use `inst > 1`. The generic parser includes `inst === 1` (one-time payment) while bank adapters exclude it. This means a generic CSV with "1" in the installments column gets `installments: 1`, which is semantically wrong (1-time payment is not installments). This is a minor inconsistency.

6. **XLSX parser `parseDateToISO` short-year date ambiguity**: The short-year parsing at `xlsx.ts:218-220` uses `year >= 50 ? 1900 + year : 2000 + year`. This means year 49 becomes 2049 and year 50 becomes 1950. This boundary is arbitrary — statements from the 1940s would be incorrectly dated, but this is not a realistic concern for Korean credit card statements.

7. **`TransactionReview.svelte` AI progress calculation**: At line 91, `aiProgress = Math.round((done / total) * 100)`. If `total` is 0, this produces `NaN` which `Math.round` converts to `NaN`. However, `targets.length` is checked at line 80 (`if (targets.length === 0)`) and the function returns early, so `total` is always > 0 when this line is reached.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C10-01 | LOW | High | `reward.ts:265-268` | Global cap over-count correction is subtle — needs documentation |
| C10-02 | MEDIUM | High | `matcher.ts:46-55, taxonomy.ts:69-76` | Short merchant names (2 chars) falsely match longer keywords via `kw.includes(lower)` |
| C10-03 | LOW | Medium | `xlsx.ts:193-203` | `parseDateToISO` doesn't guard against `Infinity` from Excel formula errors |
| C10-04 | LOW | High | `CategoryBreakdown.svelte:87` | Subcategory color fallback goes to gray instead of parent category color (extends D-42/D-46/D-64) |
| C10-05 | LOW | High | `greedy.ts:256-268` | bestSingleCard computation is O(n*m) — acceptable at current scale |
| C10-06 | MEDIUM | High | `FileDropzone.svelte:192-211` | `handleUpload` always sets `uploadStatus = 'success'` even when analysis fails |
| C10-07 | LOW | Medium | `OptimalCardMap.svelte:62` | `as const` type assertion works but fragile — maintainability note |
| C10-08 | LOW | High | `TransactionReview.svelte:6` | AI categorizer import is dead code — same as D-10/D-68 |
| C10-09 | MEDIUM | High | `analyzer.ts:266-271,293-311` | `reoptimize` includes all-month transactions but initial optimization uses only latest month — cap distortion |
| C10-10 | LOW | High | `SavingsComparison.svelte:174` | Annual savings projection * 12 is simplistic — same as D-40 |
| C10-11 | LOW | High | `detect.ts:8-105` | BANK_SIGNATURES patterns should not use `g` flag — latent risk note |
| C10-12 | MEDIUM | Medium | `store.svelte.ts:124-127` | SessionStorage truncation only omits transactions but optimization object can also be large |
| C10-13 | LOW | Medium | `matcher.ts:32-79` | Empty merchant name matches first keyword with 0.8 confidence |
