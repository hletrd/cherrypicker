# Architect Review -- Cycle 59

## Architecture Status
Factory pattern and shared column-matcher continue to work well. Server/web duplication is a known deferred item (D-01).

## A59-01: KRW prefix gap in PDF patterns (Medium)
The PDF `AMOUNT_PATTERN` is the row-detection gatekeeper. Missing KRW means PDFs with KRW notation fall through entirely. This is a format diversity bug, not just a parity issue.

## A59-02: YYMMDD validation consolidation (Low)
`isYYMMDDLike()` / `isValidYYMMDD()` is duplicated in 3 PDF files plus the CSV generic parser. Should live in `date-utils.ts`. Extract once, import everywhere.

## Deferred (unchanged)
- D-01: Web/server shared module architecture
- D-02: Web-side CSV parser duplication (10 manual adapters)
- D-03: PDF multi-line header support