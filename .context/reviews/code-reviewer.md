# Code Review -- Cycle 26

## Finding 1: Web CSV adapters missing memo extraction for 5 banks [HIGH]

**Location:** `apps/web/src/lib/parser/csv.ts`

The web-side bank adapters for Hyundai, IBK, Woori, Hana, and NH all declare `memoIdx` via `findColumn()` but NEVER extract memo into the transaction object.

Server-side adapter-factory.ts (line 156): `if (memoCol !== -1 && cells[memoCol]) tx.memo = cells[memoCol];`

Web-side adapters skip this entirely. Users parsing these banks through the web app lose memo/비고/적요 data.

Affected adapters:
- hyundaiAdapter: memoIdx via '비고' (line 560), no extraction (line 588)
- ibkAdapter: memoIdx via '적요' (line 907), no extraction (line 935)
- wooriAdapter: memoIdx via '비고' (line 768), no extraction (line 796)
- hanaAdapter: memoIdx via '적요' (line 698), no extraction (line 726)
- nhAdapter: memoIdx via '비고' (line 836), no extraction (line 865)

## Finding 2: PDF merchant extraction fails with reversed column order [MEDIUM]

**Location:** `packages/parser/src/pdf/index.ts` (line 158), `apps/web/src/lib/parser/pdf.ts` (line 357)

Both PDF parsers use:
```typescript
if (!merchant && dateIdx < amountIdx) {
  // scan between date and amount
}
```

When dateIdx >= amountIdx (amount column before date), merchant scan is skipped entirely. Some PDF formats have non-standard column order.

## Finding 3: Test coverage gap for summary rows with date context [LOW]

**Location:** `packages/parser/__tests__/column-matcher.test.ts`

No test verifies that `isValidHeaderRow` rejects rows like `['2024-01-15', '합계', '50000']` (summary row with a date-like string that contains a recognized date keyword format).