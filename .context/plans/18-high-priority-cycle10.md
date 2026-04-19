# Plan 18 — High-Priority Fixes (Cycle 10)

**Priority:** HIGH
**Findings addressed:** C10-06, C10-09, C10-02
**Status:** DONE

---

## Task 1: Fix `handleUpload` to check `analysisStore.error` before setting success status (C10-06)

**Finding:** `apps/web/src/components/upload/FileDropzone.svelte:192-211` — When `analysisStore.analyze()` is called, the store catches errors internally (setting `error` and `result = null`) without re-throwing. The `handleUpload` function always sets `uploadStatus = 'success'` and navigates to the dashboard, even when the analysis failed. This redirects the user away from the upload page with no way to retry.

**Files:**
- `apps/web/src/components/upload/FileDropzone.svelte`

**Implementation:**
1. After `await analysisStore.analyze(...)`, check `analysisStore.error` before setting success:
```ts
await analysisStore.analyze(uploadedFiles, {
  bank: bank || undefined,
  previousMonthSpending: (() => { const v = Number(previousSpending); return Number.isFinite(v) && v >= 0 ? v : undefined; })(),
});

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

**Commit:** `fix(web): 🛡️ check analysisStore.error before setting upload success status`

---

## Task 2: Filter `reoptimize` transactions to latest month to match initial optimization behavior (C10-09)

**Finding:** `apps/web/src/lib/analyzer.ts:266-271,293-311` — `analyzeMultipleFiles` filters to the latest month for optimization (`latestTransactions`), but `reoptimize` passes ALL months' transactions. This causes cap distortion: non-latest-month transactions consume reward caps that should be available for the latest month.

**Files:**
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/store.svelte.ts`

**Implementation:**
1. In `analyzer.ts`, export a helper that determines the latest month from a transaction list:
```ts
export function getLatestMonth(transactions: CategorizedTx[]): string | null {
  if (transactions.length === 0) return null;
  const months = new Set<string>();
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      months.add(tx.date.slice(0, 7));
    }
  }
  const sorted = [...months].sort();
  return sorted[sorted.length - 1] ?? null;
}
```

2. In `store.svelte.ts`, update `reoptimize` to filter transactions to the latest month before passing to `optimizeFromTransactions`:
```ts
async reoptimize(editedTransactions: CategorizedTx[], options?: AnalyzeOptions): Promise<void> {
  loading = true;
  error = null;
  try {
    const categoryLabels = await getCategoryLabels();
    // Filter to the latest month to match the initial optimization behavior.
    // analyzeMultipleFiles only optimizes the latest month; reoptimize must
    // do the same to avoid cap distortion from non-latest-month transactions.
    const latestMonth = getLatestMonth(editedTransactions);
    const latestTransactions = latestMonth
      ? editedTransactions.filter(tx => tx.date.startsWith(latestMonth))
      : editedTransactions;
    const optimization = await optimizeFromTransactions(latestTransactions, options, categoryLabels);
    if (result) {
      // Keep all months in the transactions field for display/editing,
      // but the optimization only covers the latest month.
      result = { ...result, transactions: editedTransactions, optimization };
      generation++;
      persistToStorage(result);
      persistWarningKind = _persistWarningKind;
    } else {
      error = '분석 결과가 없어요. 다시 분석해 보세요.';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요';
  } finally {
    loading = false;
  }
},
```

**Commit:** `fix(web): 🛡️ filter reoptimize transactions to latest month to match initial optimization`

---

## Task 3: Add minimum merchant name length guard for `kw.includes(lower)` substring matching (C10-02)

**Finding:** `packages/core/src/categorizer/matcher.ts:46-55` and `packages/core/src/categorizer/taxonomy.ts:69-76` — Short merchant names (e.g., 2 CJK characters like "스타") falsely match longer keywords via `kw.includes(lower)`. An empty merchant name matches the first keyword with 0.8 confidence.

**Files:**
- `packages/core/src/categorizer/matcher.ts`
- `packages/core/src/categorizer/taxonomy.ts`

**Implementation:**
1. In `matcher.ts`, add a guard at the beginning of `match()`:
```ts
match(merchantName: string, rawCategory?: string): MatchResult {
  const lower = merchantName.toLowerCase().trim();

  // Guard: empty or single-character merchant names cannot be meaningfully
  // categorized by keyword matching. Return uncategorized immediately.
  if (lower.length < 2) {
    return { category: 'uncategorized', confidence: 0.0 };
  }
  // ... rest of method
```

2. In `matcher.ts`, add a minimum length check for the `kw.includes(lower)` direction at step 2:
```ts
// 2. Substring match against MERCHANT_KEYWORDS keys (confidence 0.8)
let bestStaticKw: { category: string; subcategory?: string; kwLen: number } | undefined;
for (const [kw, categoryStr] of Object.entries(ALL_KEYWORDS)) {
  if (!isSubstringSafeKeyword(kw)) continue;
  if (lower.includes(kw)) {
    // merchant contains keyword — always meaningful
    const [category, subcategory] = categoryStr.includes('.')
      ? categoryStr.split('.') as [string, string]
      : [categoryStr, undefined];
    if (!bestStaticKw || kw.length > bestStaticKw.kwLen) {
      bestStaticKw = { category, subcategory, kwLen: kw.length };
    }
  } else if (kw.includes(lower) && lower.length >= 3) {
    // keyword contains merchant — only meaningful when merchant name is
    // long enough (>= 3 chars) to avoid false positives like "스타" matching "스타벅스"
    const [category, subcategory] = categoryStr.includes('.')
      ? categoryStr.split('.') as [string, string]
      : [categoryStr, undefined];
    if (!bestStaticKw || kw.length > bestStaticKw.kwLen) {
      bestStaticKw = { category, subcategory, kwLen: kw.length };
    }
  }
}
```

3. In `taxonomy.ts`, apply the same minimum length check at step 3 (fuzzy match):
```ts
// 3. Fuzzy match — keyword contains merchant name (partial reverse)
// Only apply when merchant name is >= 3 chars to avoid false positives
let bestFuzzy: { category: string; subcategory?: string; kwLen: number } | undefined;
if (lower.length >= 3) {
  for (const [kw, mapping] of this.keywordMap) {
    if (kw.includes(lower)) {
      if (!bestFuzzy || kw.length < bestFuzzy.kwLen) {
        bestFuzzy = { ...mapping, kwLen: kw.length };
      }
    }
  }
}
```

**Commit:** `fix(core): 🛡️ add minimum merchant name length guard for reverse substring matching`

---

## Progress

- [x] Task 1: Fix `handleUpload` error check
- [x] Task 2: Filter reoptimize transactions to latest month
- [x] Task 3: Add minimum merchant name length guard
