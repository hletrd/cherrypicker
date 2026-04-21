# Cycle 81 Plan — Fixes from Review

## Task 1: Snapshot result in reoptimize() to prevent concurrent mutation (C81-01)

**Severity:** MEDIUM | **Confidence:** MEDIUM  
**File:** `apps/web/src/lib/store.svelte.ts:558`

**Problem:** `reoptimize()` uses `...result!` spread at line 558, which reads the current reactive `$state` value, not a snapshot captured at function entry. If `result` changes between the initial null guard (line 489) and the final assignment (line 558) — for example, if `analyze()` is called concurrently during the `await` at line 495 or 551 — the spread would mix data from two different analysis runs. Practical risk is low because `loading=true` disables UI, but the pattern is unsafe.

**Fix:** Capture a snapshot of `result` immediately after the null guard and use it throughout the function instead of reading the reactive `result` variable.

**Implementation:**
```typescript
// After the null guard at line 489:
if (!result) {
  clearStorage();
  error = '분석 결과가 없어요. 다시 분석해 보세요.';
  return;
}
const snapshot = result;

// Then replace all `result!` references with `snapshot`:
// Line 537: snapshot.previousMonthSpendingOption
// Line 558: ...snapshot,
```

**Status:** TODO

---

## Task 2: Align bank-specific CSV adapter header scan limit with generic parser (C81-02)

**Severity:** LOW | **Confidence:** HIGH  
**File:** `apps/web/src/lib/parser/csv.ts` (lines 288, 355, 421, 487, 552, 617, 683, 748, 814, 879)

**Problem:** Bank-specific CSV adapters scan only `Math.min(10, lines.length)` rows for header detection, while the generic parser scans `Math.min(30, lines.length)`. If a bank export has 10+ metadata rows before the header, the bank-specific adapter fails, then falls through to the generic parser which succeeds. The adapter's failure message is prepended to the result, confusing users who see an error message despite successful parsing.

**Fix:** Increase all bank-specific adapter header scan limits from 10 to 30 to match the generic parser.

**Implementation:** Change all 10 occurrences of `Math.min(10, lines.length)` to `Math.min(30, lines.length)` in the bank adapter `parseCSV` methods.

**Status:** TODO

---

## Task 3: Pass categoryNodes through to parseAndCategorize instead of redundant loadCategories (C81-03)

**Severity:** LOW | **Confidence:** HIGH  
**File:** `apps/web/src/lib/analyzer.ts:106`

**Problem:** `parseAndCategorize()` calls `loadCategories()` at line 106 even when a `MerchantMatcher` is provided (indicating the caller already loaded categories). In `analyzeMultipleFiles()` (line 266), the caller already fetched categories and built the matcher. The redundant `loadCategories()` call returns from cache, but creates an unnecessary `await` and makes the data flow unclear.

**Fix:** Add an optional `categoryNodes` parameter to `parseAndCategorize()`. When provided, skip the `loadCategories()` call and use the passed-in nodes directly.

**Implementation:**
```typescript
export async function parseAndCategorize(
  file: File,
  options?: AnalyzeOptions,
  fileIndex?: number,
  matcher?: MerchantMatcher,
  categoryNodes?: CategoryNode[],  // NEW parameter
): Promise<...> {
  // ...
  const nodes = categoryNodes ?? await loadCategories();
  // Guard against empty categories...
  if (nodes.length === 0) {
    throw new Error('카테고리 데이터를 불러올 수 없어요. 다시 시도해 보세요.');
  }
  const effectiveMatcher = matcher ?? new MerchantMatcher(toRulesCategoryNodes(nodes));
  // ...
}

// In analyzeMultipleFiles(), pass categoryNodes:
const allParsed = await Promise.all(
  files.map((f, i) => parseAndCategorize(f, options, i, sharedMatcher, categoryNodes))
);
```

**Status:** TODO

---

## Task 4: Add missing subcategory keys to CATEGORY_COLORS (C81-04)

**Severity:** LOW | **Confidence:** MEDIUM  
**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`

**Problem:** `getCategoryColor()` tries dot-notation key, then leaf ID, then uncategorized fallback. But `CATEGORY_COLORS` does not include dot-notation subcategory keys like `"utilities.apartment_mgmt"`. For `utilities.apartment_mgmt`, the function tries the full key (not found), then leaf `apartment_mgmt` (not found), then falls back to gray. This makes some subcategory expenses appear as uncategorized gray in the chart.

**Fix:** Add the missing dot-notation subcategory keys to `CATEGORY_COLORS` so they map to their parent category colors. The keys to add are all dot-notation entries that correspond to the subcategories in the YAML taxonomy but are missing from the map.

**Implementation:** Add these entries to `CATEGORY_COLORS`:
```typescript
'dining.delivery': '#84cc16',       // same as delivery
'grocery.convenience_store': '#eab308',  // same as convenience_store
'online_shopping.general': '#22c55e',    // parent color
'online_shopping.fashion': '#e879f9',    // same as fashion
'offline_shopping.department_store': '#15803d',  // same as department_store
'public_transit.subway': '#3b82f6',      // same as subway
'public_transit.bus': '#60a5fa',         // same as bus
'public_transit.taxi': '#818cf8',        // same as taxi
'transportation.fuel': '#7c3aed',        // same as fuel
'transportation.parking': '#78716c',     // same as parking
'transportation.toll': '#a8a29e',        // same as toll
'medical.hospital': '#0d9488',           // same as hospital
'medical.pharmacy': '#0f766e',           // same as pharmacy
'education.academy': '#d97706',          // same as academy
'education.books': '#b45309',            // same as books
'entertainment.movie': '#f472b6',        // same as movie
'entertainment.streaming': '#a855f7',    // same as streaming
'entertainment.subscription': '#c084fc', // same as subscription
'travel.hotel': '#0284c7',              // same as hotel
'travel.airline': '#0369a1',            // same as airline
'utilities.electricity': '#facc15',      // same as electricity
'utilities.gas': '#fb923c',              // same as gas
'utilities.water': '#38bdf8',            // same as water
'utilities.apartment_mgmt': '#6b7280',   // parent color (utilities)
```

**Status:** TODO

---

## Deferred Items from This Cycle

### C81-01 concurrent reoptimize/analyze risk — extremely low probability

- **Original finding:** C81-01
- **Severity:** LOW (theoretical concurrency)
- **Confidence:** MEDIUM
- **File+line:** `apps/web/src/lib/store.svelte.ts:558`
- **Reason for deferral:** The snapshot fix (Task 1) addresses the most common pattern. However, even with a snapshot, if `analyze()` completes between the null guard and the final assignment, the `result = {...snapshot, ...}` would overwrite the new analysis result. The `loading=true` guard prevents most concurrent calls, and the `generation++` mechanism ensures the UI re-syncs on the next render. A full mutex/lock pattern would be over-engineering for a client-side app.
- **Exit criterion:** If users report mixed data from concurrent analyze/reoptimize calls, add a generation check before the final assignment to avoid overwriting newer results.

### C81-04 CATEGORY_COLORS long-term drift

- **Original finding:** C81-04 extends C66-08/C74-04/C77-04
- **Severity:** LOW
- **Confidence:** MEDIUM
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`
- **Reason for deferral:** The dot-notation keys fix (Task 4) covers the current taxonomy. However, when the YAML taxonomy in `packages/rules/data/categories.yaml` is updated with new subcategories, `CATEGORY_COLORS` must be updated in lockstep. The long-term fix is to derive colors from the parent category dynamically (e.g., `utilities.*` always uses the utilities color) rather than maintaining an exhaustive map. This is an architectural change that should be part of the broader hardcoded-map consolidation (deferred across 17+ cycles).
- **Exit criterion:** When the hardcoded-map consolidation refactor lands, replace `CATEGORY_COLORS` with a dynamic parent-derivation function.
