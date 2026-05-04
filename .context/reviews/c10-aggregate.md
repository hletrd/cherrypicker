# Cycle 10 — Parser Format Diversity Review

## Test Baseline
- Bun: 242 pass, 0 fail (7 files)
- Vitest: 231 pass, 0 fail (9 files)

## Findings (11 new, prioritized)

### HIGH

**F-01: `isAmountLike` misses parenthesized negative amounts**
Both generic CSV parsers (server `generic.ts:30-35` + web `csv.ts:131-136`) use patterns that don't match `(1,234)` format. The actual `parseAmount`/`parseCSVAmount` handle this, creating an inference blind spot.
Fix: Add `/^\([\d,]+\)$/` to AMOUNT_PATTERNS in both files.

**F-02: Server generic CSV parser missing date error reporting**
Server `generic.ts:129` calls `parseDateStringToISO` directly without `isValidISODate` check. Web `csv.ts:47-55` correctly reports malformed dates. Users of CLI get silent data corruption.
Fix: Add `isValidISODate` check + error push in server generic.ts.

**F-03: Server XLSX parser date error check inconsistency**
Server `xlsx/index.ts:92` uses `result === raw.trim()` instead of `!isValidISODate(result)`. Web `xlsx.ts:243` correctly uses `isValidISODate`.
Fix: Use `isValidISODate` in server XLSX parser.

**F-04: Server `date-utils.ts` missing `isValidISODate` export**
Server-side date-utils lacks `isValidISODate` which exists in web-side date-utils.
Fix: Add export to server-side date-utils.

### MEDIUM

**F-05: Zero tests for CSV shared utilities**
`parseCSVAmount`, `isValidCSVAmount`, `parseCSVInstallments`, `splitCSVLine` in `shared.ts` have no dedicated tests.
Fix: Add comprehensive test file.

**F-06: Server PDF `tryStructuredParse` error swallowing**
Server `pdf/index.ts:140-146` catches all errors and returns null silently. Web `pdf.ts:295` logs a warning.
Fix: Add `console.warn` to server-side, matching web behavior.

**F-07: No tests for CSV shared `splitCSVLine` edge cases**
RFC 4180 parsing (quoted fields, doubled quotes, escaped commas) is untested.
Fix: Add tests.

**F-08: Column config duplication across 3 files**
`BANK_COLUMN_CONFIGS` defined in `xlsx/adapters/index.ts`, `web/xlsx.ts`, and `csv/adapter-factory.ts`.
Fix: Document as known duplication (architectural constraint due to different build systems).

### LOW

**F-09: Web CSV bank adapters don't use factory pattern**
600+ lines of near-identical adapter code in `web/csv.ts` vs 100-line factory on server.
Fix: Deferred (cross-module refactor).

**F-10: DATE_PATTERNS array duplicated in server + web generic CSV**
Same pattern arrays in `server/csv/generic.ts:19-26` and `web/csv.ts:120-127`.
Fix: Deferred (shared module requires build system refactor).

**F-11: No transaction-level deduplication**
Duplicate rows in CSV/XLSX are parsed as separate transactions.
Fix: Deferred (requires UX decisions on dedup display).