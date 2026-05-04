# Cycle 72 Plan

## Fix 1: Space-before-원 in amount parsing (C72-01)
Change `원$` to `\s*원$` in all 6 parseAmount functions.
Change `원?` to `\s*원?` in 2 AMOUNT_PATTERNS arrays (server+web generic CSV).

## Fix 2: Server XLSX isHTMLContent BOM strip (C72-02)
Add `.replace(/^﻿/, '')` before toLowerCase() in server isHTMLContent.

## Fix 3: Add missing column header patterns (C72-03)
Add to column-matcher.ts: "사용금액", "매입일", "전표일", "거래내역", "이용가맹점명"
Update HEADER_KEYWORDS and category Sets accordingly.

## Fix 4: Tests for all new patterns
Add tests for space-before-원 parsing, new column patterns, BOM handling.

## Deferred (explicitly not this cycle)
- PDF multi-line headers
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode
- Generic parser fallback behavior