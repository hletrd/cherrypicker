# Verifier — cherrypicker (Cycle 13)

**Reviewer:** verifier
**Date:** 2026-05-05

---

## Verification Summary

### Test Status
- **Bun tests**: 1408 passing, 0 failing (up from 313 — column-matcher tests added)
- **Vitest tests**: 322 passing, 0 failing (up from 231)
- **Total**: ~1730 tests passing

### Code Consistency Checks
- [PASS] All parsers use `parseDateStringToISO` from date-utils
- [PASS] All parsers use shared ColumnMatcher patterns
- [PASS] All parsers filter zero/negative amounts
- [PASS] All parsers report unparseable amount errors
- [PASS] Server CSV adapter-factory NOW reports date errors (C12-01 FIXED)
- [PASS] Server CSV adapter-factory NOW validates dates with isValidISODate (C12-06 FIXED)
- [PASS] Web XLSX parser NOW uses shared findColumn (C12-02 FIXED)
- [FAIL] PDF fallback trailing-minus amounts lose negativity (C13-04)
- [PASS] XLSX parsers handle merged cells via forward-fill
- [PASS] PDF parsers validate short dates with month-aware limits
- [PASS] HTML-as-XLS detection works in both server/web

### Parity Check: Server vs Web
| Feature | Server | Web | Status |
|---------|--------|-----|--------|
| ColumnMatcher | imported | imported | PARITY |
| Date error reporting | all adapters | all adapters | PARITY |
| findColumn in XLSX | shared module | shared module | PARITY (FIXED) |
| BANK_COLUMN_CONFIGS | separate file | inline | TECH DEBT |
| detectBank | separate file | inline | TECH DEBT |
| HTML parser tests | YES | NO | GAP (T13-01) |
| OFX parser tests | YES | NO | GAP (T13-01) |
| JSON parser tests | YES | NO | GAP (T13-01) |

---

## New Findings

### V13-01: PDF fallback trailing-minus bug verified [MEDIUM]

**File:** `apps/web/src/lib/parser/pdf.ts:565, 604`
**Method:** Static analysis of regex capture groups + parseAmount logic

1. `fallbackAmountPattern` group 6: `([\d,]*(?:,|\d{5,})[\d,]*)-` captures only digits
2. `amountMatch[6]` = `"1,234"` (minus lost)
3. `parseAmount("1,234")` → `hasTrailingMinus = false` → returns positive
4. Line 613 `amount > 0` passes → refund treated as spending

**Confidence:** High

---

## Gate Evidence

- `npm run lint` — PASS (0 errors, 0 warnings)
- `npm run typecheck` — PASS (0 errors)
- `bun run test` — PASS (1408 tests, 14 files)
- `npx vitest run` — PASS (322 tests, 9 files)
