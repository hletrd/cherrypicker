# Cycle 65 Code Reviewer Report

## F1: AMOUNT_PATTERNS bare-integer threshold mismatch (FIX - Medium)
Files:
- `packages/parser/src/csv/generic.ts` line 73: `^\d{8,}원?$`
- `apps/web/src/lib/parser/csv.ts` line 188: `^\d{8,}원?$`

Both server and web generic CSV parsers require 8+ digits for bare integer amounts during
column detection. The PDF parser uses 5+ digits. Fix: change to `^\d{5,}원?$`.

## F2: Server adapter-factory silent detect failures (FIX - Low)
File: `packages/parser/src/csv/adapter-factory.ts` signature-detect loop
Web-side has console.warn; server-side does not. Fix: add console.warn for parity.

## F3: Silent failure on data-inference column detection (FIX - Low)
File: `packages/parser/src/csv/generic.ts` lines 149-191
When data-inference fails, return error message instead of empty result.