# Cycle 74 Implementation Plan

**Date:** 2026-04-22
**Status:** In Progress

---

## Task 1: Add dot-notation subcategory keys to FALLBACK_CATEGORIES in TransactionReview

**Finding:** C74-01
**Severity:** LOW / HIGH
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:13-27`

**Problem:** When the categories.json fetch fails, the `FALLBACK_CATEGORIES` list only contains top-level category entries. The `categoryMap` built from this list lacks dot-notation subcategory keys (e.g., `"dining.cafe"`), so the subcategory label search at line 122 fails for fallback categories.

**Fix:** Add dot-notation entries for common subcategories to the `FALLBACK_CATEGORIES` array. This ensures the search functionality works even when the fetch fails.

**Implementation:**
```svelte
const FALLBACK_CATEGORIES = [
  // ... existing top-level entries ...
  { id: 'dining.cafe', label: '  카페' },
  { id: 'dining.restaurant', label: '  음식점' },
  { id: 'dining.fast_food', label: '  패스트푸드' },
  { id: 'dining.delivery', label: '  배달' },
  { id: 'grocery.supermarket', label: '  대형마트' },
  { id: 'grocery.convenience_store', label: '  편의점' },
  { id: 'transportation.fuel', label: '  주유' },
  { id: 'transportation.parking', label: '  주차' },
  { id: 'public_transit.subway', label: '  지하철' },
  { id: 'public_transit.bus', label: '  버스' },
  { id: 'public_transit.taxi', label: '  택시' },
  { id: 'online_shopping.fashion', label: '  패션' },
];
```

---

## Task 2: Add sessionStorage schema version check to loadFromStorage

**Finding:** C74-02
**Severity:** LOW / MEDIUM
**File:** `apps/web/src/lib/store.svelte.ts:202-285`

**Problem:** `loadFromStorage()` removes sessionStorage on ANY malformed data without distinguishing between corrupted data and version-mismatched data from a newer/older app version. This causes silent data loss on schema changes.

**Fix:** Add a `_version` field to the persisted data. On load, if the version doesn't match, warn in the console but still attempt to parse the data (forward-compatible). Only remove the data if it's genuinely corrupted (fails validation).

**Implementation:**
- Add `const STORAGE_VERSION = 1;` constant
- Include `_version: STORAGE_VERSION` in the persisted object
- On load, check `_version` and log a warning if it doesn't match, but continue with validation
- Only `sessionStorage.removeItem()` on validation failure, not version mismatch

---

## Task 3: Refactor isHTMLContent to return decoded prefix to avoid double-decode in XLSX parser

**Finding:** C74-03 (re-confirmation of C73-06)
**Severity:** LOW / HIGH
**File:** `apps/web/src/lib/parser/xlsx.ts:258-287`

**Problem:** `isHTMLContent()` decodes the first 512 bytes, then `parseXLSX()` decodes the entire buffer again for HTML-as-XLS files. This wastes CPU and memory for the overlapping 512 bytes.

**Fix:** Refactor `isHTMLContent` to return both the detection result and the decoded prefix string. The caller can reuse this prefix when decoding the full buffer.

**Implementation:**
```typescript
function checkHTMLContent(buffer: ArrayBuffer): { isHTML: boolean; prefix: string } {
  const raw = new TextDecoder('utf-8').decode(buffer.slice(0, 512));
  const head = raw.replace(/^\uFEFF/, '').trimStart().toLowerCase();
  const isHTML = head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
  return { isHTML, prefix: raw };
}
```
Then in `parseXLSX`, use the returned `prefix` as the start of the full decode.

---

## Task 4: Run quality gates (eslint, tsc --noEmit, vitest, bun test)

**Requirement:** All gates must pass before cycle completion.

---

## Deferred Items (this cycle)

The following findings from this cycle's review are deferred per the repo's rules:

### C74-04: formatIssuerNameKo and getIssuerColor hardcoded maps will drift
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/lib/formatters.ts:51-78,115-143`
- **Reason for deferral:** Currently in sync with all 24 banks. The drift risk is structural and would require a significant refactor (extracting bank metadata into a shared data source). This is the same class as C66-08/D-42/D-64, tracked as a long-term architectural improvement.
- **Exit criterion:** When a shared bank metadata module is created, replace all five hardcoded maps with imports from the shared module.

### C74-05: ALL_BANKS in FileDropzone is 5th copy of bank list needing sync
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`
- **Reason for deferral:** Same class as C74-04. Currently in sync. The fix requires extracting bank metadata into a shared data source, which is a significant refactor.
- **Exit criterion:** When a shared bank metadata module is created, replace ALL_BANKS with an import.

### C74-06: greedyOptimize bestSingleCard redundantly recalculates
- **Severity:** LOW / MEDIUM
- **File:** `packages/core/src/optimizer/greedy.ts:329-340`
- **Reason for deferral:** This is a constant-factor (2x) overhead on an already-quadratic algorithm (C67-01). The optimization would require changing the `buildCardResults` return type to include single-card calculations, which is a non-trivial API change. For typical workloads (< 1000 transactions, < 10 cards), the overhead is negligible.
- **Exit criterion:** If optimization latency becomes noticeable (> 5s), reuse `buildCardResults` output for `bestSingleCard` computation.

### C74-07: AbortError vs genuine fetch failure not distinguished in error message
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/lib/analyzer.ts:271-273`
- **Reason for deferral:** The error message "카테고리 데이터를 불러올 수 없어요" is not misleading -- it correctly describes the symptom. Adding nuance about the cause (abort vs failure) would require plumbing the abort information through the call chain, which adds complexity for a rare edge case. The user's response is the same in both cases: retry.
- **Exit criterion:** If users report confusion about the error message after navigating away during analysis, add a "(취소됨)" suffix when the cause is an AbortError.

### C74-08: CSV adapter registry covers 10 of 24 detected banks
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/lib/parser/csv.ts:910-921`
- **Reason for deferral:** This is an intentional design tradeoff. The top 10 banks cover the vast majority of Korean credit card statements. The generic CSV parser provides reasonable fallback coverage for the remaining 14 banks. Adding dedicated adapters requires real statement samples for testing, which are not currently available.
- **Exit criterion:** When statement samples from the remaining 14 banks are available, add dedicated adapters.

### C74-09: persistToStorage does not validate per-field sizes
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/lib/store.svelte.ts:127-171`
- **Reason for deferral:** In practice, `cardResults` is bounded by the number of card rules (~683) and each entry is small. The serialized size is well under 1MB. Adding per-field size checks would add complexity with minimal practical benefit.
- **Exit criterion:** If users report `persistWarning = 'corrupted'` with normal-sized uploads, add per-field truncation for `cardResults` entries.

---

## Task 5: Fix server-side PDF isValidDateCell short-date validation [MEDIUM]

**Finding:** F1 from cycle 74 parser review
**File:** `packages/parser/src/pdf/table-parser.ts`

**Problem:** `isValidDateCell` uses `DATE_PATTERN.test()` for all date types including short dates (MM.DD). The DATE_PATTERN regex's short-date alternative uses lookahead but no end-anchor, and critically does NOT validate month/day ranges. A cell like "13.01" would pass as a valid date (month 13 is invalid). The function should use `isValidShortDate()` (already defined in the same file) which validates month 1-12 and day ranges via `daysInMonth()`. The web-side PDF parser already uses the anchored `SHORT_MD_DATE_PATTERN`.

**Fix:** Modify `isValidDateCell` to add a SHORT_MD_DATE_PATTERN check that delegates to `isValidShortDate` before falling through to `DATE_PATTERN`.

---

## Progress

- [x] Task 1: Add subcategory fallback keys to TransactionReview
- [x] Task 2: Add sessionStorage schema version check
- [x] Task 3: Refactor isHTMLContent to avoid double-decode
- [x] Task 4: Quality gates — all pass
- [ ] Task 5: Fix server-side PDF isValidDateCell short-date validation
