# Cycle 100 Implementation Plan (FINAL CYCLE)

## Goal
Fix 3 high-severity server/web parity bugs and 2 lower issues. Ensure the web-side parsers produce identical results to server-side parsers.

## Fixes (ordered by priority)

### FIX 1: Web HTML parser — add forward-fill [F1, HIGH]
- **File**: `apps/web/src/lib/parser/html.ts`
- **Action**: Port the forward-fill pattern from `packages/parser/src/html/index.ts` into the web-side `parseHTMLSheet()` function
- **Details**: Add last-value tracking for all 6 columns (date, merchant, category, installments, memo, amount) with isNonEmpty() helper and SUMMARY_ROW_PATTERN guard

### FIX 2: Web JSON parser — accept negative amounts [F2, HIGH]
- **File**: `apps/web/src/lib/parser/json.ts`
- **Action**: Change `amount <= 0` to `amount === 0`, add `Math.abs()` for negative values
- **Details**: Match server-side behavior: skip zero, accept negative (store absolute)

### FIX 3: Web OFX parser — add CCSTMTRS terminators [F3, HIGH]
- **File**: `apps/web/src/lib/parser/ofx.ts`
- **Action**: Add `</CCSTMTRS` and `</CREDITCARDMSGSRSV1` to the SGML terminator pattern
- **Details**: Match server-side SGML regex exactly

### FIX 4: Shared normalizeHTML utility [F5, LOW]
- **Action**: Extract `normalizeHTML()` to `packages/parser/src/csv/shared.ts` (already a shared utilities module)
- **Files affected**: `packages/parser/src/html/index.ts`, `packages/parser/src/xlsx/index.ts`, `packages/parser/src/csv/shared.ts`

## Deferred
- F4 (web content sniffing): Complex browser API work, low impact
- F6 (web parser tests): Requires significant test infrastructure

## Quality Gates
- `bun test` in packages/parser
- `bun run build` for full monorepo
- TypeScript typecheck
- Lint