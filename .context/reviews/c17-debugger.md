# Cycle 17 — Debugger Review

**Date:** 2026-05-05
**Scope:** Latent bugs, failure modes, regressions, edge cases

## Findings

### C17-DEBUG01 [MEDIUM] — Server-side PDF fallback parses trailing-minus amounts as positive
- **File:** `packages/parser/src/pdf/index.ts:318-359`
- **Root cause:** The fallback amount regex has `([\d,]*(?:,|\d{5,})[\d,]*)-` where the minus is outside the capture group. The captured string "1,234" is passed to `parseAmountString`, which does NOT see the trailing minus and returns positive 1234 instead of negative -1234.
- **Failure scenario:** A user uploads a PDF with refund entries formatted as "1,234-" (common in some Korean bank statements). The CLI tool parses this as a positive transaction, inflating the user's spending total. The web app (which has the correct regex) would parse the same file correctly as a refund/negative.
- **Regression check:** This is a parity regression — the web-side regex was fixed in an earlier cycle but the server-side was not updated to match.
- **Confidence:** High

### C17-DEBUG02 [LOW] — `normalizeHTML` misses structural tags
- **File:** `apps/web/src/lib/parser/html.ts:27`, `packages/parser/src/csv/shared.ts:180`
- **Failure scenario:** An HTML export contains `</div   >` or `</span   >`. SheetJS may fail to parse the table correctly because the malformed tag is not normalized, leading to missing transactions.
- **Confidence:** Low

### C17-DEBUG03 [LOW] — `parseOFXDate` timezone conversion may produce wrong dates for cross-midnight offsets
- **File:** `apps/web/src/lib/parser/ofx.ts:46-73`, `packages/parser/src/ofx/index.ts`
- **Issue:** The timezone offset conversion uses `Date.UTC(year, month, day, hour, minute, second) - tzOffset * 3600000` followed by `+ 9 * 3600000`. For negative tzOffsets (e.g., UTC-5), the calculation subtracts a negative (adds 5 hours) then adds 9 more. The math is correct but subtle — a bug here would be hard to detect.
- **Failure scenario:** An OFX file with `[-5:EST]` timezone would convert 2024-01-15 23:00 EST to 2024-01-16 13:00 KST. If the math were wrong, it could produce 2024-01-15.
- **Confidence:** Low

## Summary

| Severity | Count |
|----------|-------|
| MEDIUM | 1 |
| LOW | 2 |
