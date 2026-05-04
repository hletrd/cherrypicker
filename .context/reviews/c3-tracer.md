# Tracer — Cycle 3

## F-TRC-01: ColumnMatcher adoption gap — web-side CSV adapters untouched
**Severity: High | Confidence: High**
**File**: apps/web/src/lib/parser/csv.ts

Adoption matrix after cycles 1-2:
- Server CSV adapter-factory: ColumnMatcher YES
- Server CSV generic: ColumnMatcher YES
- Server XLSX: ColumnMatcher YES
- Web CSV generic: ColumnMatcher YES
- Web XLSX: ColumnMatcher YES
- **Web CSV bank adapters (10 files): ColumnMatcher NO — still uses indexOf()**

The web-side bank adapters are the last remaining parsers using exact string matching.

## F-TRC-02: HEADER_KEYWORDS vocabulary split across 4 independent copies
**Severity: Medium | Confidence: High**
**Files**: generic.ts:47-51, xlsx/index.ts:133-137, web/csv.ts:158-162, web/xlsx.ts:369-373

All 4 copies must be updated in lockstep when a new keyword is added. The keyword category Sets (DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS) are also duplicated 4 times.

## F-TRC-03: Server-side XLSX multi-sheet selection inconsistency
**Severity: Medium | Confidence: High**
**Files**: packages/parser/src/xlsx/index.ts:117-124 vs apps/web/src/lib/parser/xlsx.ts:319-337

Server returns first sheet with transactions. Web selects sheet with most transactions. Different behavior for the same data.
