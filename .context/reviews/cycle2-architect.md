# Cycle 2 Architectural Review

## Review Scope
Repository-wide architecture with focus on parser package design.

---

## F-ARCH-01: Three independent parser implementations with no shared code between server, web, and server-generics
**Severity: Medium | Confidence: High**
**Files**: `packages/parser/src/`, `apps/web/src/lib/parser/`

The codebase has three parser "ecosystems":
1. Server-side adapter-factory-based parsers (`packages/parser/src/csv/adapter-factory.ts`) using `ColumnMatcher`
2. Server-side legacy bank-specific parsers (`packages/parser/src/csv/generic.ts`) with inline regexes
3. Web-side parsers (`apps/web/src/lib/parser/`) with 10 hand-coded bank adapters using `indexOf()`

Cycle 1 introduced `ColumnMatcher` and the adapter-factory for the server-side, but the web-side was deferred. The XLSX and PDF parsers also have their own inline patterns. This means there are at least 5 independent sets of column-matching patterns that must be kept in sync manually.

---

## F-ARCH-02: XLSX bank column config exists in 3 places
**Severity: Medium | Confidence: High**
**Files**: `packages/parser/src/xlsx/adapters/index.ts`, `apps/web/src/lib/parser/xlsx.ts` lines 18-170, `packages/parser/src/csv/adapter-factory.ts` lines 144-241

The XLSX parser has a centralized `BANK_COLUMN_CONFIGS` for all 24 banks. The web-side has its own copy of the same config (maintained in sync via xlsx-parity.test.ts). The CSV adapter-factory has a separate set of 10 bank configs with slightly different field names. There is no single source of truth for bank column configurations.

---

## F-ARCH-03: Web-side csv.ts is 1030 lines of mostly duplicated adapter code
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts`

The web-side csv.ts contains 10 bank adapters, each ~60 lines, following an identical template. The server-side was refactored in cycle 1 to use a configurable adapter-factory that reduces each bank to a 5-line config object. The web-side still has the original 1030-line implementation.

**Architectural debt**: Any change to the parsing logic (e.g., a new column type, changed amount parsing, new date format) must be applied to all 10 adapters in both server and web codebases.

---

## F-ARCH-04: Date parsing is correctly centralized but pattern matching is not
**Severity: Low | Confidence: High**
**Files**: `packages/parser/src/date-utils.ts`, `apps/web/src/lib/parser/date-utils.ts`

The `parseDateStringToISO` function is correctly centralized in both server and web `date-utils.ts` modules (they're copies). However, the regex patterns used for column detection (is the header a date column?) and PDF table detection (is this cell a date?) are scattered across 6+ files as inline patterns rather than being shared from column-matcher.ts.

---

## F-ARCH-05: BankId type includes 24 banks but only 10 have CSV adapters
**Severity: Low | Confidence: High**
**Files**: `packages/parser/src/types.ts` line 2, `packages/parser/src/csv/adapter-factory.ts`

BankId defines 24 banks, but only 10 have dedicated CSV adapters. Banks like 'kakao', 'toss', 'kbank', etc. have no CSV adapters. For these banks, the parser falls through to the generic CSV parser which works fine. But the XLSX parser has configs for all 24 banks. The architecture would benefit from a unified bank config registry that both CSV and XLSX parsers reference.