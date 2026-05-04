# Cycle 9 Comprehensive Code Review — Parser Package

**Date:** 2026-05-04
**Scope:** packages/parser/, apps/web/src/lib/parser/
**Baseline:** 231 bun tests passing, 8 prior cycles completed

---

## F1 — XLSX duplicate column silently picks first match (MEDIUM)

**File:** `packages/parser/src/xlsx/index.ts` line 238-245

`findCol()` uses `findIndex()` which returns the FIRST matching column. If a spreadsheet has columns "이용금액" and "이용금액(원)" (common in Samsung/Hyundai exports), the first one is always selected even if the second is the actual transaction amount. Similarly, the CSV ColumnMatcher `findColumn()` has the same behavior but the impact is less severe since CSV column names tend to be unique.

**Fix:** When multiple columns match, prefer the one whose data rows contain more parseable amounts.

---

## F2 — Server-side detectBank missing confidence cap (MEDIUM)

**File:** `packages/parser/src/detect.ts` lines 196-206 vs `apps/web/src/lib/parser/detect.ts` lines 151-161

The server-side `detectBank()` HAS the confidence cap for single-pattern banks (added cycle 7). The web-side `detectBank()` ALSO has it. Parity confirmed. **No action needed** — this was previously flagged as a divergence but has been resolved.

---

## F3 — CSV splitCSVLine only handles quoted fields for comma delimiter (LOW)

**File:** `packages/parser/src/csv/shared.ts` line 10

When delimiter is not comma, the function falls back to `line.split(delimiter).map(v => v.trim())`. If a tab-delimited file contains quoted fields (e.g., merchant names with embedded tabs), they won't be parsed correctly. The web-side `splitLine()` has the identical limitation.

**Impact:** Low — tab/semicolon-delimited Korean card exports rarely use quoted fields. The main CSV delimiter (comma) is correctly handled.

---

## F4 — XLSX parser has no graceful degradation (MEDIUM)

**File:** `packages/parser/src/xlsx/index.ts`

Unlike the CSV parser which falls back from bank-specific → signature-detect → generic, the XLSX parser calls SheetJS once and if it fails (corrupted file, unsupported format), the error propagates unhandled. The `parseXLSX()` function has no try/catch around the `xlsx.read()` call on line 149.

**Fix:** Wrap `xlsx.read()` in try/catch, return a user-friendly ParseResult with error message.

---

## F5 — PDF table-parser false positives from AMOUNT_PATTERN (MEDIUM)

**File:** `packages/parser/src/pdf/table-parser.ts` line 5

`AMOUNT_PATTERN = /[\d,]+원?/` matches ANY digit sequence (including dates, phone numbers, card numbers). This causes `filterTransactionRows()` to incorrectly identify non-transaction rows. For example, a line "카드번호 1234-5678-9012-3456" would match both DATE_PATTERN (false) and AMOUNT_PATTERN (false positive from "1234").

**Fix:** Use a stricter pattern that requires either the Won suffix or comma-separated numbers (indicating currency amounts, not card numbers).

---

## F6 — Server XLSX findCol doesn't use shared findColumn (LOW)

**File:** `packages/parser/src/xlsx/index.ts` lines 238-245

The XLSX parser defines its own `findCol()` closure instead of using the shared `findColumn()` from `column-matcher.ts`. The logic is identical (exact match → regex fallback) but uses `findIndex` with `pattern.test(normalizeHeader(h))` instead of the shared function's two-pass approach. Additionally, `findColumn()` already returns -1 for no match, so the inline version is unnecessary duplication.

**Fix:** Import and use the shared `findColumn()` function.

---

## F7 — PDF line scanner doesn't validate short dates (MEDIUM)

**File:** `packages/parser/src/pdf/index.ts` line 188

The fallback date pattern includes `\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])` which matches short dates like "3.5" without calling `isValidShortDate()`. This means decimal amounts like "3,500원" could be partially matched as dates when the comma is stripped. The structured parser has `isValidShortDate()` but the fallback scanner doesn't use it.

**Fix:** After matching the fallback date pattern against a short date, validate it with `isValidShortDate()`.

---

## F8 — Web CSV parser English merchant column missing from inference (LOW)

**File:** `apps/web/src/lib/parser/csv.ts` lines 219-246 and `packages/parser/src/csv/generic.ts` lines 119-143

When the merchant column can't be identified from headers, the fallback inference looks for Korean characters in sample data. If the CSV has English merchant names (e.g., from an international card or user-reformatted data), this inference fails and falls through to "first non-reserved column" which may not be the merchant column.

**Impact:** Low — this is an edge case for English-only data.

---

## F9 — XLSX formula cells may produce wrong values (LOW)

**File:** `packages/parser/src/xlsx/index.ts` line 186

SheetJS is called with `{ header: 1, raw: true, defval: '' }`. When `raw: true`, formula cells return their cached value. If the cache is stale or the formula produced a non-integer result, `Math.round()` in `parseAmount()` handles rounding. However, error cells (#REF!, #VALUE!) would be returned as strings and would fail parsing gracefully (null → skip).

**Impact:** Low — error handling already exists. The `cellDates: false` setting correctly avoids auto-converting number cells to Date objects.

---

## F10 — Server PDF parseDateStringToISO doesn't validate as thoroughly as web-side (LOW)

Both sides use the shared `parseDateStringToISO()` from their respective `date-utils.ts` files. The server version and web version are functionally identical — they validate month/day ranges with `isValidDayForMonth()`. The web-side additionally has `isValidISODate()` check on the result for error reporting, while the server-side uses a different approach (checking if result === input and result doesn't look like ISO). Both are correct but use different validation strategies.

---

## F11 — DetectFormat BOM detection via explicit byte marker vs replacement character (LOW)

**File:** `packages/parser/src/detect.ts` line 64

`decodeBuffer()` strips BOM with `decoded.replace(/^﻿/, '')` using the actual BOM replacement character. Meanwhile, `parseCSV()` in `csv/index.ts` strips with `content.replace(/^﻿/, '')` using the unicode escape. Both work, but the `decodeBuffer` approach relies on the source file containing the literal replacement character. If the file was read as UTF-8 (where BOM is 3 bytes EF BB BF), TextDecoder produces the replacement character U+FEFF which is then matched. This is correct.

---

## Summary of Actionable Findings

| ID | Severity | Description | Action |
|----|----------|-------------|--------|
| F4 | MEDIUM | XLSX parser has no try/catch around xlsx.read() | Fix |
| F5 | MEDIUM | PDF AMOUNT_PATTERN too loose, matches card numbers | Fix |
| F6 | LOW | XLSX findCol duplicates shared findColumn() | Fix |
| F7 | MEDIUM | PDF fallback scanner doesn't validate short dates | Fix |
| F1 | MEDIUM | XLSX duplicate column picks first match | Defer |
| F3 | LOW | CSV splitCSVLine only handles quotes for comma | Defer |
| F8 | LOW | English merchant inference gap | Defer |
| F9 | LOW | XLSX formula cells | Already handled |
| F10 | LOW | Date validation strategy differences | Parity OK |
| F11 | LOW | BOM detection approach | Correct as-is |