# Performance Review — Cycle 1 (perf-reviewer)

## Scope
Full repository review with focus on parser performance.

---

## C1-PF-01: CSV parsing splits entire file into lines array in memory
**Severity: Medium | Confidence: High**

All CSV parsers do `content.split('\n').filter(...)` which creates an array of ALL lines in memory. For large statement files (e.g., annual exports with 10,000+ transactions), this doubles memory usage since both the full string and the line array are held.

Files affected:
- `packages/parser/src/csv/generic.ts` line 33
- `packages/parser/src/csv/hyundai.ts` line 18
- All other bank adapters
- `apps/web/src/lib/parser/csv.ts` line 137

**Impact**: Moderate — Korean credit card statements rarely exceed 10MB, so this is acceptable for most use cases.

**Fix**: Consider streaming line-by-line parsing for very large files. Not urgent.

---

## C1-PF-02: XLSX parsing loads entire workbook into memory via SheetJS
**Severity: Low | Confidence: High**

`packages/parser/src/xlsx/index.ts` line 98: `xlsx.read(buffer, { type: 'buffer' })` loads the entire XLSX file into memory. SheetJS decompresses all sheets regardless of which one is needed.

**Impact**: Low — XLSX files from Korean card companies are typically small (< 1MB).

---

## C1-PF-03: PDF text extraction and table parsing are synchronous on large files
**Severity: Low | Confidence: Medium**

`packages/parser/src/pdf/table-parser.ts` scans all lines synchronously. The `detectColumnBoundaries` function iterates over all lines multiple times (char counting, boundary detection, column splitting).

**Impact**: Low — PDF statements are typically 1-2 pages.

---

## C1-PF-04: Bank detection scans entire content string for each bank's patterns
**Severity: Low | Confidence: High**

`packages/parser/src/detect.ts` lines 114-131: For each of 24 banks, iterates over all patterns and tests against the full content string. Worst case: 24 banks * ~3 patterns = 72 regex tests against the full content.

**Impact**: Negligible — regex tests are fast, and content is typically small. The 30-line scan limit in `detectCSVDelimiter` already shows awareness of this concern.