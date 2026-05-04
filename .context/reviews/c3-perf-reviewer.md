# Perf Reviewer — Cycle 3

## F-PERF-01: Server-side detectFormat reads CSV file twice
**Severity: Low | Confidence: High**
**File**: packages/parser/src/detect.ts lines 207-211

detectFormat() reads the file for format detection, then reads it again for bank detection. Should read once.

## F-PERF-02: Category keyword Sets recreated on every parse call
**Severity: Low | Confidence: Medium**
**Files**: generic.ts:56-58, adapter-factory.ts:79-81, xlsx/index.ts:173-175, web/csv.ts:166-168

DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS Sets are created fresh per function call. Should be module-level constants.
