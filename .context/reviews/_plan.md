# Implementation Plan -- Cycle 43

## P1. Fix findColumn exact-match path for combined headers [MEDIUM]
**Files:**
- `packages/parser/src/csv/column-matcher.ts` (lines 29-34)
- `apps/web/src/lib/parser/column-matcher.ts` (lines 26-30)

**Change:** In the exact-match pass, after the full-header comparison, split on "/" and test each part against the normalized exactName. This makes the exact-match path consistent with the regex path.

**Before:**
```ts
if (exactName) {
  const normalizedExact = normalizeHeader(exactName);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeader(headers[i] ?? '') === normalizedExact) return i;
  }
}
```

**After:**
```ts
if (exactName) {
  const normalizedExact = normalizeHeader(exactName);
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i] ?? '');
    if (normalized === normalizedExact) return i;
    // Split combined headers on "/" for exact matching (C43-01)
    if (normalized.includes('/')) {
      if (normalized.split('/').some((part) => part === normalizedExact)) return i;
    }
  }
}
```

## P2. Add tests for findColumn with combined headers [MEDIUM]
**File:** `packages/parser/__tests__/column-matcher.test.ts`

Add test cases:
- findColumn with exactName "이용일" and header "이용일/승인일" returns correct index
- findColumn with exactName "이용금액" and header "이용금액/취소금액" returns correct index

## P3. Add test for tab-separated CSV with quoted fields [LOW]
**File:** `packages/parser/__tests__/csv-shared.test.ts`

Add test for splitCSVLine with tab delimiter and quoted fields containing tabs.

## Deferred (not this cycle)
- F2: Web CSV factory refactor (~700 lines, too large)
- A2: Column-matcher shared module refactor
- A3: ColumnMatcher file relocation
