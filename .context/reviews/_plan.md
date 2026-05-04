# Cycle 27 Implementation Plan

**Source:** `_aggregate.md` (2 findings)

## Fixes

### Fix 1: PDF AMOUNT_PATTERN year false-positive (F1 -- MEDIUM)
**Files:**
- `packages/parser/src/pdf/index.ts` (line 20)
- `packages/parser/src/pdf/table-parser.ts` (line 9)
- `apps/web/src/lib/parser/pdf.ts` (lines 37, 67)

**Action:** Replace `[\d,]+` with `(?:[\d,]*,|\d{3,})[\d,]*` in all 4 PDF amount patterns.
This requires either a comma (thousand separator) or minimum 3 digits for bare integers,
preventing 4-digit year values like "2024" from matching as amounts while still accepting
valid amounts like "100", "1,234", "12345", "₩6,500".

### Fix 2: Year-value rejection tests (F2 -- LOW)
**File:** `packages/parser/__tests__/table-parser.test.ts`

**Action:** Add tests verifying:
- `AMOUNT_PATTERN` does NOT match "2024", "2025" when preceded by space
- `AMOUNT_PATTERN` matches "1,234", "100", "12345", "₩6,500"
- `findAmountCell` returns null for rows with only year values