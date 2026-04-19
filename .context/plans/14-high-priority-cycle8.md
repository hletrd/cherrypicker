# Plan 14 — High-Priority Fixes (Cycle 8)

**Priority:** HIGH
**Findings addressed:** C8-02, C8-03, C8-11
**Status:** DONE

---

## Task 1: Extend PDF fallback date pattern to match Korean and short-date formats (C8-02)

**Finding:** `apps/web/src/lib/parser/pdf.ts:303` — The fallback line-scanning parser uses `fallbackDatePattern = /(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2})/` which only matches YYYY-MM-DD and YY-MM-DD formats. It does NOT match Korean dates ("1월 15일", "2024년 1월 15일") or MM/DD short dates. When the structured parser fails and the fallback parser runs, lines with Korean dates are skipped entirely, losing transactions.

**File:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**
1. Add regex patterns for Korean dates and short dates at the module level:
```ts
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])/;
```

2. Update `fallbackDatePattern` on line 303 to include all supported formats:
```ts
const fallbackDatePattern = /(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d]))/;
```

3. The `parseDateToISO(dateMatch[1]!)` call on line 322 already handles all these formats, so no change is needed there.

**Commit:** `fix(web): 🐩 extend PDF fallback date pattern to match Korean and short-date formats`

---

## Task 2: Extend PDF `findDateCell` to search Korean and short-date formats (C8-03)

**Finding:** `apps/web/src/lib/parser/pdf.ts:182-188` — The `findDateCell` function only checks cells against `STRICT_DATE_PATTERN` and `SHORT_YEAR_DATE_PATTERN`. It does not check for Korean date formats or MM/DD short dates. If a PDF table row has a Korean date cell, `findDateCell` returns null and the row is skipped.

**File:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**
1. Add Korean and short-date pattern constants (can reuse from Task 1):
```ts
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /^\d{1,2}[.\-\/]\d{1,2}$/;
```

2. Update `findDateCell` to check these additional patterns:
```ts
function findDateCell(row: string[]): { idx: number; value: string } | null {
  for (let i = 0; i < row.length; i++) {
    const cell = row[i] ?? '';
    if (
      STRICT_DATE_PATTERN.test(cell) ||
      SHORT_YEAR_DATE_PATTERN.test(cell) ||
      KOREAN_FULL_DATE_PATTERN.test(cell) ||
      KOREAN_SHORT_DATE_PATTERN.test(cell) ||
      SHORT_MD_DATE_PATTERN.test(cell)
    ) return { idx: i, value: cell };
  }
  return null;
}
```

**Commit:** `fix(web): 🐩 extend PDF structured findDateCell to match Korean and short-date formats`

---

## Task 3: Reset `_loadPersistWarningKind` after consumption and in `reset()` (C8-11)

**Finding:** `apps/web/src/lib/store.svelte.ts:154` — `_loadPersistWarningKind` is set in `loadFromStorage` and read during store initialization, but is never reset to `null` after being consumed. If the store is re-created (HMR), the stale value could produce an incorrect warning. The `reset()` method also doesn't reset it.

**File:** `apps/web/src/lib/store.svelte.ts`

**Implementation:**
1. In the store initialization, consume and reset `_loadPersistWarningKind`:
```ts
// In createAnalysisStore(), after computing persistWarningKind:
persistWarningKind = result !== null && result.transactions === undefined
  ? (_loadPersistWarningKind ?? 'truncated')
  : null;
_loadPersistWarningKind = null; // Reset after consumption
```

2. In the `reset()` method, add reset for `_loadPersistWarningKind`:
```ts
reset(): void {
  result = null;
  error = null;
  loading = false;
  persistWarningKind = null;
  _persistWarningKind = null;
  _loadPersistWarningKind = null;  // Reset load-time warning
  clearStorage();
},
```

**Commit:** `fix(web): 🛡️ reset _loadPersistWarningKind after consumption and in store reset`

---

## Progress

- [x] Task 1: Extend PDF fallback date pattern
- [x] Task 2: Extend PDF findDateCell
- [x] Task 3: Reset _loadPersistWarningKind
