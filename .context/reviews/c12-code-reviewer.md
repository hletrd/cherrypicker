# Code Review — Cycle 12

**Date:** 2026-05-05
**Reviewer:** code-reviewer

## Critical Findings

### C12-01: Server CSV adapter-factory silently swallows unparseable dates (BUG)
**File**: `packages/parser/src/csv/adapter-factory.ts:129`
**Severity**: High (data loss)
The adapter factory calls `parseDateStringToISO(dateRaw)` WITHOUT passing `errors` and `lineIdx` parameters. This means unparseable dates are silently returned as raw strings with no error reported to the user. Compare with the generic CSV parser (`csv/generic.ts:180`) which DOES report date errors via `isValidISODate()`. Users of bank-specific adapters (hyundai, kb, ibk, woori, samsung, shinhan, lotte, hana, nh, bc) get no feedback about malformed dates.

### C12-02: Web XLSX parser uses local findCol instead of shared findColumn (Inconsistency)
**File**: `apps/web/src/lib/parser/xlsx.ts:423-430`
**Severity**: Medium (code quality)
The web XLSX parser defines a local `findCol()` closure instead of importing `findColumn` from `./column-matcher.ts`. While functionally similar, this bypasses the shared module. If the shared `findColumn` logic ever changes (e.g., adding priority weighting), the web XLSX parser would not benefit.

### C12-03: Column-matcher module has zero dedicated test coverage (Test gap)
**File**: `packages/parser/src/csv/column-matcher.ts`
**Severity**: Medium (test coverage)
The `findColumn()`, `normalizeHeader()`, `isValidHeaderRow()`, and all `*_COLUMN_PATTERN` constants are core infrastructure used by every parser. Yet there are NO dedicated tests for this module. Edge cases like zero-width spaces, parenthetical suffixes, English case-insensitive matching, and category-based header validation are only tested indirectly through adapter tests.

### C12-04: CSV isDateLike() patterns don't allow spaces around delimiters
**File**: `packages/parser/src/csv/generic.ts:19-26`
**Severity**: Low-Medium (format diversity)
The `isDateLike()` heuristic patterns use `\d{4}[.\-\/]\d{1,2}` without allowing spaces. But `parseDateStringToISO()` uses `[.\-\/\s]` which DOES allow spaces. A cell like "2024 - 01 - 15" would parse correctly but NOT be detected as a date column by the generic parser's inference path. Same issue in web CSV `csv.ts:121`.

### C12-05: Web XLSX BANK_COLUMN_CONFIGS is full duplication
**File**: `apps/web/src/lib/parser/xlsx.ts:28-180`
**Severity**: Low (tech debt)
153 lines of bank config duplicated from `packages/parser/src/xlsx/adapters/index.ts`.

### C12-06: Server CSV adapter-factory does not validate parsed dates
**File**: `packages/parser/src/csv/adapter-factory.ts:129`
**Severity**: Medium (parity)
Unlike the generic CSV parser and all other parsers, the adapter-factory path does not call `isValidISODate()` after parsing. A malformed date could propagate downstream as a non-ISO string.

## Positive Notes
- Column-matcher patterns are comprehensive with English alternatives
- Forward-fill for merged XLSX cells is well-implemented across both server/web
- PDF fallback line scanner with short-date validation is solid
- Bank detection confidence capping for single-pattern banks is good defensive code
- All 313 bun + 231 vitest tests passing