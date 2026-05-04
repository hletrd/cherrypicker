# Cycle 81 Architect Review

## Reviewer: architect

### Overview
After 80 cycles, the parser architecture is well-structured with clear separation between server (packages/parser) and web (apps/web/src/lib/parser) sides, shared column-matcher patterns, and a factory pattern for bank adapters. This cycle identifies one architectural gap in the PDF date detection pipeline.

## Findings

### F81-01: PDF date detection pipeline incomplete — missing YYYYMMDD [HIGH]
**Architectural Assessment**: The date detection and parsing layers have a gap. The parsing layer (`parseDateStringToISO`) is complete and handles YYYYMMDD, but the detection layer (`findDateCell`, `isValidDateCell`, `fallbackDatePattern`) in the PDF path does not recognize this format. This violates the principle that detection should be a superset of parsing — if a parser can handle a format, the detector should recognize it.

The fix is surgical: add YYYYMMDD detection to the three PDF detection functions (findDateCell, isValidDateCell, fallbackDatePattern) on both server and web sides. No architectural changes needed.

### D-01: Shared module refactor (DEFERRED, unchanged)
**Status**: Still deferred. The server/web duplication of helper functions (splitLine, parseAmount, parseInstallments, isValidAmount) remains. This is an architectural debt item that doesn't affect correctness but increases maintenance burden. The current code is well-commented with cross-references.

## Architecture Assessment
The parser is architecturally sound. The column-matcher module provides excellent shared vocabulary. The factory pattern for bank adapters is clean. The PDF tiered parsing (structured -> fallback line scan -> LLM) is well-designed. No new architectural concerns in this cycle.
