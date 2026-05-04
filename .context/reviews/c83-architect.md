# Cycle 83 — Architect Report

## Architecture Assessment

### Server/Web Parity Status
After 82 cycles, server and web parsers are functionally equivalent. Both sides
implement the same algorithms with the same validation logic. The remaining
duplication (splitLine, parseAmount, parseInstallments, isValidAmount,
splitCSVContent, date detection helpers) is noted as deferred item D-01
(shared module between Bun and browser environments) and is architecturally
acceptable given the different module systems (Bun vs browser ESM).

### Format Diversity Assessment
The parser now handles:
- 24 bank CSV adapters with flexible column matching
- RFC 4180 multi-line quoted CSV
- BOM stripping, encoding detection (UTF-16/CP949)
- Delimiter auto-detection (comma, tab, pipe, semicolon)
- Full-width digit/comma/dot/minus/parentheses normalization
- Won sign (₩/￦), KRW prefix, 마이너스, trailing-minus, parenthesized negatives
- YYMMDD, YYYYMMDD, full-date, short-date, Korean date formats
- Excel serial date numbers, Date objects, formula error cells
- XLSX merged cell forward-fill with summary row guards
- PDF column-boundary detection with header-aware extraction
- PDF fallback line scanner with reversed column order support

### Remaining Architectural Debt
1. **D-01: Shared module** — `parseAmount`, `splitLine`, `splitCSVContent` are
   duplicated between server (Bun) and web (browser). Requires a build-time
   shared package or runtime-agnostic module. DEFERRED.
2. **D-02: PDF multi-line headers** — Some PDFs have header text split across
   multiple lines. The current single-line header detection misses these.
   DEFERRED (complex, rare).
3. **D-03: parseDateToISO duplication** — Exists in 3 places with slightly
   different signatures (date-utils.ts, xlsx/index.ts, pdf/index.ts). Could
   be consolidated. DEFERRED (low impact).

### No New Architecture Issues This Cycle