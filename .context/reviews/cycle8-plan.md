# Cycle 8 — Implementation Plan

## Priority 1: Fix Won sign stripping in web-side parsers (C8-01, C8-02, C8-03)

### apps/web/src/lib/parser/xlsx.ts
Line 245: Add `.replace(/[₩￦]/g, '')` to string path of parseAmount.
```ts
let cleaned = raw.trim().replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '');
```

### apps/web/src/lib/parser/csv.ts
Line 67: Add `.replace(/[₩￦]/g, '')` to parseAmount.
```ts
cleaned = cleaned.replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
```

### apps/web/src/lib/parser/pdf.ts
Line 188: Add `.replace(/[₩￦]/g, '')` to parseAmount.
```ts
let cleaned = raw.replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '');
```

## Priority 2: Add merged cell forward-fill to web XLSX parser (C8-04)

Port the forward-fill logic from `packages/parser/src/xlsx/index.ts` lines 261-296 to `apps/web/src/lib/parser/xlsx.ts` parseXLSXSheet function.

Add tracking variables before the data loop:
```ts
let lastDate: unknown = '';
let lastMerchant: unknown = '';
let lastCategory: unknown = '';
```

Replace direct cell reads with forward-fill logic for date, merchant, and category columns.

## Priority 3: Remove unused import (C8-05)

Remove `HEADER_KEYWORDS` from the import in `apps/web/src/lib/parser/xlsx.ts` line 12.

## Priority 4: Add server-side tests for Won sign parsing

Add test cases to the existing vitest suite to validate Won sign handling in XLSX and PDF parsers.

## Verification
1. `bun test` — expect all 481 pass
2. `npx vitest run` — expect all 231+ pass
3. `npx turbo lint` — expect 0 errors
4. `bun run build` — expect 0 errors