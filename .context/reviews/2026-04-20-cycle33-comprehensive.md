# Cycle 33 Comprehensive Code Review — 2026-04-20

**Reviewer:** Single-agent comprehensive review (full re-read of all source files)
**Scope:** All packages/core, packages/parser, packages/rules, apps/web, tools/ source files

---

## Verification of Prior Cycle Fixes

All prior findings from cycles 1-32 re-verified. Status unchanged from `_aggregate.md` except as noted below.

| Finding | Status | Evidence |
|---|---|---|
| C32-01 | FIXED | `packages/parser/src/csv/generic.ts:128` now uses `Math.round(parseFloat(...))` matching web-side behavior |
| C32-02 | FIXED | `packages/parser/src/csv/generic.ts:245` now filters zero-amount rows |
| C32-03 | FIXED | `packages/parser/src/csv/index.ts:73` now wraps `parseGenericCSV` in try/catch |

---

## New Findings

### C33-01: MerchantMatcher substring scan is O(n) over ALL_KEYWORDS on every call — MEDIUM / High

**File:** `packages/core/src/categorizer/matcher.ts:55-71`

The `match()` method iterates over every entry in `ALL_KEYWORDS` using `Object.entries()` for every single transaction's merchant name. With hundreds of keyword entries and potentially thousands of transactions, this is O(keywords * transactions) for the substring path alone.

```typescript
for (const [kw, categoryStr] of Object.entries(ALL_KEYWORDS)) {
  if (!isSubstringSafeKeyword(kw)) continue;
  const merchantContainsKw = lower.includes(kw);
  ...
}
```

**Impact:** Performance degradation on large statement files (500+ transactions). The exact-match path (hash lookup) is fast, but any merchant that misses exact match falls into this linear scan.

**Fix:** Build a trie or sorted array for binary search on keywords, or pre-filter candidates by first character. At minimum, cache `Object.entries(ALL_KEYWORDS)` at module level instead of recomputing per call.

**Confidence:** High

---

### C33-02: cachedCategoryLabels in store.svelte.ts never invalidated on explicit reset when result is null — MEDIUM / Medium

**File:** `apps/web/src/lib/store.svelte.ts:309,491-502`

The `reset()` method correctly sets `cachedCategoryLabels = undefined`. However, `getCategoryLabels()` at line 311-329 only checks `if (cachedCategoryLabels) return cachedCategoryLabels;` — there is no mechanism to invalidate it when the underlying categories.json data changes (e.g., redeployment with new categories). Combined with the C21-04 finding about stale caches across long-lived tabs, this means the category labels map can become permanently stale if the categories.json is updated on the server.

**Impact:** Category labels in the optimizer will show stale Korean names after a redeployment that adds/renames categories. The user would need to hard-refresh the page.

**Fix:** Add a cache TTL or version check. Alternatively, add a `forceReload` parameter to `loadCategories()` and `getCategoryLabels()` that bypasses the fetch cache.

**Confidence:** Medium (requires server deployment change to manifest)

---

### C33-03: parseAmount in pdf.ts returns 0 for unparseable amounts instead of null — LOW / High

**File:** `apps/web/src/lib/parser/pdf.ts:166-177`

```typescript
function parseAmount(raw: string): number {
  const n = Math.round(parseFloat(cleaned));
  return Number.isNaN(n) ? 0 : n;
}
```

The comment says "Return 0 instead of NaN so callers never have to guard against NaN propagation," but this means unparseable amounts silently become 0 and are then filtered by the zero-amount check. The caller cannot distinguish between a genuinely zero amount and an unparseable one. The CSV parser's `isValidAmount()` approach (returning NaN + error push) is more informative because it produces a parse error message.

The PDF structured path at line 231-237 does check for this case and pushes errors, but the fallback path at line 344-357 does not distinguish between `parseAmount` returning 0 from NaN vs. actual zero. This means unparseable amounts in the fallback path are silently dropped without error reporting.

**Impact:** Users get no feedback when the fallback PDF scanner encounters unparseable amounts — the transactions are silently omitted.

**Fix:** Return `null` from `parseAmount` for NaN cases (matching the CSV/XLSX parsers), and have callers handle null explicitly with error reporting.

**Confidence:** High

---

### C33-04: SplitCSVLine in generic.ts (server-side) does not handle escaped quotes (doubled "") — LOW / Medium

**File:** `packages/parser/src/csv/generic.ts:133-153`

The `splitCSVLine` function handles `"` by toggling `inQuotes`, but does not handle the RFC 4180 escape sequence of doubled quotes (`""` inside a quoted field). The web-side `splitLine` in `csv.ts` has the same limitation. If a Korean credit card CSV contains a merchant name like `"스타벅스 ""더하기"" 점"`, the parser would split incorrectly.

**Impact:** Low — Korean credit card CSVs rarely contain escaped quotes in merchant names, and the generic parser's header detection would likely still work.

**Fix:** Add handling for doubled quotes: `if (char === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; }` (matching the web-side `splitLine` pattern which already has this at `csv.ts:14`).

Wait — checking the web-side code at `csv.ts:14`:
```typescript
if (char === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; }
```

The web-side already handles this. The server-side `generic.ts` does NOT have this handling. This is a parity bug.

**Confidence:** Medium (parity discrepancy between server and web)

---

### C33-05: analyzer.ts toCoreCardRuleSets does not validate tiers[].unit narrowing — LOW / Low

**File:** `apps/web/src/lib/analyzer.ts:63-67`

The adapter function narrows `rule.card.source` and `rewards[].type` against explicit allowlists, but does not validate `tiers[].unit` values. The core package's `RewardTier` type has `unit: string | null`, but `calculateFixedReward` in `reward.ts` only handles specific unit values (`'won_per_day'`, `'mile_per_1500won'`, `'won_per_liter'`, `null`). An unknown unit value would silently produce 0 reward.

**Impact:** Low — all YAML data files use known unit values, and Zod schema validation at build time catches new values. But the adapter's narrowing is incomplete compared to the type assertions on source and type.

**Fix:** Either add unit validation in the adapter, or document that unit values are validated by the YAML schema.

**Confidence:** Low (no current data triggers this)

---

### C33-06: buildCardResults totalSpending uses Math.abs(tx.amount) but greedyOptimize filters only positive amounts — LOW / Medium

**File:** `packages/core/src/optimizer/greedy.ts:224`

```typescript
const totalSpending = assignedTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
```

But at line 270:
```typescript
const sortedTransactions = [...constraints.transactions]
  .filter((tx) => tx.amount > 0 && Number.isFinite(tx.amount))
```

The optimizer only assigns positive-amount transactions, so `assignedTransactions` will never contain negative amounts. The `Math.abs()` is therefore redundant but not harmful. However, it creates a misleading implication that negative amounts could be present, which could confuse future maintainers into thinking the optimizer handles refunds.

**Impact:** No functional bug — `Math.abs()` on always-positive values is a no-op. But it obscures the optimizer's actual invariant.

**Fix:** Replace `Math.abs(tx.amount)` with `tx.amount` and add a comment noting that the optimizer only assigns positive-amount transactions.

**Confidence:** Medium

---

## Final Sweep — Confirmation of Coverage

All source files in the following directories were examined:
- `packages/core/src/` — all .ts files (optimizer, calculator, categorizer, models)
- `packages/parser/src/` — all .ts files (csv, xlsx, pdf, detect)
- `packages/rules/src/` — all .ts files (schema, loader)
- `apps/web/src/lib/` — all .ts files (analyzer, store, cards, formatters, api, parser/*, build-stats)
- `apps/web/src/components/` — all .svelte files (dashboard/*, cards/*, upload/*, ui/*)
- `apps/web/src/pages/` — all .astro files
- `apps/web/src/layouts/` — Layout.astro
- `tools/cli/src/` and `tools/scraper/src/` — reviewed for completeness

No files were skipped. Cross-file interactions (parser parity, cache invalidation chains, type adapter bridges) were explicitly analyzed.
