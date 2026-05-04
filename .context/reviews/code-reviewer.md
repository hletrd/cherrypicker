# Cycle 77 Code Review

## F1: DATE_KEYWORDS Set Missing 5 Date Terms (Server + Web) [TO FIX]

**Severity**: Medium (format diversity, header detection)
**Location**: `packages/parser/src/csv/column-matcher.ts` line 100, `apps/web/src/lib/parser/column-matcher.ts` line 84

The `DATE_KEYWORDS` ReadonlySet is missing 5 date-related terms that ARE present in `DATE_COLUMN_PATTERN` regex and `HEADER_KEYWORDS` array: `취소일`, `정산일`, `환불일`, `반품일`, `교환일`. These were added to the regex and HEADER_KEYWORDS in earlier cycles but the keyword Set was never updated.

**Impact**: `isValidHeaderRow()` requires keywords from 2+ categories. A header row where the date column exclusively uses one of these 5 terms (e.g., "환불일" + "금액") would be rejected because "환불일" is not in `DATE_KEYWORDS`, causing the row to only match 1 category (amount). The header detection would then fail, returning no transactions.

**Fix**: Add the 5 missing terms to `DATE_KEYWORDS` in both server and web column-matcher files.

## F2: PDF Multi-Line Header Support [DEFERRED]

Architecturally complex, marginal benefit. Not actionable this cycle.

## F3: Server/Web D-01 Shared Module Refactor [DEFERRED]

Different build systems (Bun vs Vite/Astro) prevent direct imports. Not actionable this cycle.

## Server/Web Parity Status

After thorough comparison, all patterns, keywords, and category sets are IN SYNC across all 6 column-matcher files (3 server, 3 web). The only discrepancy is Finding 1 — both sides have the same missing terms.

## No Regressions

All 1641 tests pass (287 vitest + 1354 bun).