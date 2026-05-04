# Cycle 2 Verifier Review — Evidence-Based Correctness Check

---

## F-VER-01: Verified: adapter-factory correctly delegates to detectBank
**Status: PASS | Confidence: High**
**File**: `packages/parser/src/csv/adapter-factory.ts` lines 63-66

Confirmed that the adapter-factory's `detect()` method delegates to the centralized `detectBank()` from detect.ts rather than duplicating patterns. This is correct and consistent.

---

## F-VER-02: Verified: ColumnMatcher handles whitespace and parenthetical suffixes
**Status: PASS | Confidence: High**
**File**: `packages/parser/src/csv/column-matcher.ts` lines 9-11

The `normalizeHeader` function trims whitespace, collapses internal whitespace, and removes parenthetical suffixes. This handles the common variations in Korean bank exports. Tests in csv-adapters.test.ts lines 14-29 confirm this behavior.

---

## F-VER-03: Verified: BOM stripping works on both server and web
**Status: PASS | Confidence: High**
**Files**: `packages/parser/src/csv/index.ts` line 35, `apps/web/src/lib/parser/csv.ts` line 969

Both entry points strip UTF-8 BOM (U+FEFF) before parsing. The server-side uses `content.replace(/^﻿/, '')` while the web-side uses `content.replace(/^﻿/, '')`. Wait -- the server-side csv/index.ts line 35 uses `content.replace(/^﻿/, '')` which is the BOM character literally embedded in the source. Let me verify...

Actually, looking more carefully: line 35 of `packages/parser/src/csv/index.ts` has `const cleanContent = content.replace(/^﻿/, '');` -- the `﻿` is the UTF-8 BOM character (U+FEFF). This is correct but fragile -- it depends on the source file being saved with the literal BOM character. The web-side uses `﻿` which is explicit. Both work but the web-side approach is more robust.

---

## F-VER-04: Discrepancy: server-side BOM uses literal character, web-side uses escape
**Status: WARN | Confidence: High**
**Files**: `packages/parser/src/csv/index.ts` line 35 vs `apps/web/src/lib/parser/csv.ts` line 969

Server: `content.replace(/^﻿/, '')` (literal BOM character in source)
Web: `content.replace(/^﻿/, '')` (unicode escape)

Both work, but if the server-side source file is ever re-saved without BOM, the literal character approach breaks silently. Should use `﻿` consistently.

---

## F-VER-05: Verified: date-utils.ts month/day validation prevents invalid dates
**Status: PASS | Confidence: High**
**File**: `packages/parser/src/date-utils.ts` lines 10-18

`isValidDayForMonth` correctly uses `new Date(year, month, 0).getDate()` which returns the last day of the month, correctly handling leap years. This prevents "Feb 30", "Apr 31", etc.

---

## F-VER-06: Verified: amount parsing handles parenthesized negatives correctly
**Status: PASS | Confidence: High**
**Files**: All `parseAmount` / `parseCSVAmount` functions

All 5 implementations of amount parsing (server shared.ts, server xlsx, server pdf, web csv, web xlsx, web pdf) correctly handle parenthesized negative amounts like "(1,234)" -> -1234. All use `Math.round(parseFloat(...))` for correct rounding of decimal amounts.

---

## F-VER-07: Verified: XLSX parity test ensures config alignment
**Status: PASS | Confidence: High**
**File**: `packages/parser/__tests__/xlsx-parity.test.ts`

The test correctly compares `BANK_COLUMN_CONFIGS` between server-side and web-side XLSX parsers. Any config change in one must be reflected in the other or the test fails.