# Cycle 2 Performance Review

## Review Scope
Full repository with focus on parser performance.

---

## F-PERF-01: Server-side `detectFormat` reads CSV files twice
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/detect.ts` lines 186, 207-209

For CSV files with unknown extensions, `detectFormat` reads the file once at line 186 to sniff format, then reads it again at line 207 to detect bank. For files with known .csv extension, it still reads once at line 207. The result is that every CSV file is read from disk once for detection, then read again in `parseStatement` (index.ts line 37). This means each CSV file is read from disk 2-3 times.

**Impact**: Negligible for single files. Matters for batch processing of many files. OS file cache mitigates most of the cost.

---

## F-PERF-02: XLSX parser converts all sheets even if first sheet succeeds
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 108-116

The server-side XLSX parser tries all sheets and returns the first one with transactions. For the common single-sheet case this is fine, but for multi-sheet workbooks, it converts each sheet to a 2D array (via `sheet_to_json`) even if the first sheet already has transactions. The `return result` inside the loop at line 113 exits early, so only sheets up to the first successful one are converted. This is acceptable.

---

## F-PERF-03: PDF table parser scans all lines twice (table detection + column boundaries)
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/table-parser.ts` lines 68-127

The `parseTable` function first scans all lines to find table lines, then scans all table lines again to detect column boundaries, then splits each line by columns. This is O(n) where n is the number of lines — acceptable for typical PDF statement sizes (< 1000 lines).

---

## F-PERF-04: Web-side encoding detection tries all encodings
**Severity: Low | Confidence: High**
**File**: `apps/web/src/lib/parser/index.ts` lines 32-43

The web-side always tries both UTF-8 and CP949 even if the first one produces zero replacement characters. This was intentionally changed (C63-07) to handle the case where ASCII-heavy EUC-KR files produce few replacement chars with UTF-8 decoding. The overhead is bounded by file size and is acceptable.