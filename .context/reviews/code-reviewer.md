# Code Review -- Cycle 42

## Scope
Full parser package deep review after 41 cycles of improvements.

## Findings

### F-42-01: Generic CSV `AMOUNT_PATTERNS` missing `마이너스` prefix pattern [MEDIUM]
**Files**:
- `packages/parser/src/csv/generic.ts` (AMOUNT_PATTERNS, lines 52-58)
- `apps/web/src/lib/parser/csv.ts` (AMOUNT_PATTERNS, lines 161-167)

**Issue**: The `AMOUNT_PATTERNS` arrays used by `isAmountLike()` for column inference in generic CSV parsers do not include a pattern for `마이너스`-prefixed amounts. While `parseCSVAmount()` in shared.ts correctly handles `마이너스` prefix, the column-inference heuristic `isAmountLike()` won't recognize these as amount values during headerless/generic parsing.

When a CSV file has no recognizable header keywords AND uses `마이너스`-prefixed amounts as the dominant format, the generic parser's column inference will fail to detect the amount column.

**Impact**: Generic CSV parser column inference may fail when `마이너스`-prefixed amounts are the primary format. Only affects unknown-bank CSV files without recognizable headers.

### F-42-02: Cycle 41 `[₩]` finding was incorrect -- already resolved [NONE]
**Files**: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
**Issue**: Both server and web PDF `AMOUNT_PATTERN` use `[₩￦]` character class (both Won sign characters). The cycle 41 aggregate incorrectly stated the server side uses `[₩]` alone. **No fix needed.**

### F-42-03: No format diversity issues remain unfixed [PASS]
All major format diversity issues identified across 41 cycles have been resolved:
- CSV: 24 bank adapters, generic fallback, encoding detection, BOM stripping, delimiter detection
- XLSX: HTML-as-XLS, multi-sheet, merged cell forward-fill, formula errors
- PDF: Structured table, header-aware columns, fallback line scanner, LLM fallback
- Date: 8+ format variants
- Amount: Won signs, parenthesized negatives, 마이너스, whitespace
- Unicode: NBSP, zero-width, directional markers, variation selectors

### F-42-04: Server/web parity is strong [PASS]
Column patterns, date parsing, amount parsing, header detection, summary row filtering all maintain parity between server and web implementations.

## Summary
1 actionable finding: `마이너스` pattern missing from generic CSV column inference on both server and web sides.