# Cycle 35 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 35
**Tests:** 610 bun, 103 vitest (713 total)

## Summary
Found 4 actionable findings including 1 critical bug in web PDF fallback amount extraction and 3 parity gaps between server-side and web-side PDF parsers. All cycle 34 findings confirmed already fixed.

## Cycle 34 Status Verification
All 5 cycle 34 findings are confirmed fixed:
- F-01 (PDF AMOUNT_PATTERN Won-sign): Server PDF already has ₩/￦ alternations
- F-02 (fallbackAmountPattern Won-sign): Both server/web PDF fallback regexes already include Won-sign groups
- F-03 (Server XLSX 마이너스): Already present at xlsx/index.ts:130
- F-04 (Web PDF 마이너스): Already present at web/pdf.ts:270
- F-05 (test coverage): Tests passing for all paths

## New Findings

### F-01: CRITICAL — Web PDF fallback amount group 3 not extracted (HIGH)
`apps/web/src/lib/parser/pdf.ts` line 554: `amountMatch[1] ?? amountMatch[2]` is missing `?? amountMatch[3]`.

The `fallbackAmountPattern` has 3 capture groups:
1. `\(([\d,]+\)` — parenthesized negatives
2. `[₩￦]([\d,]+)원?` — Won-sign amounts
3. `([\d,]*(?:,|\d{5,})[\d,]*)원?` — plain comma/5+digit amounts

Group 3 covers the most common amount format (e.g., "10,000" without Won sign). When these match, groups 1 and 2 are undefined, causing `amountRaw` to be `undefined`. `parseAmount(undefined)` then tries to call `.replace()` on undefined, crashing at runtime.

The server-side PDF parser at `packages/parser/src/pdf/index.ts` line 315 correctly has `amountMatch[1] ?? amountMatch[2] ?? amountMatch[3]`.

**Impact:** All PDF fallback line-scan transactions with plain comma amounts (no Won sign, no parentheses) silently fail to parse on the web side. This is the most common amount format in Korean bank PDFs.

### F-02: Server PDF parseAmount missing "마이너스" prefix (MEDIUM)
`packages/parser/src/pdf/index.ts` parseAmount (line 56-68): Handles parenthesized negatives but not "마이너스" prefix. Web PDF (pdf.ts:270), CSV shared (shared.ts:40), and all XLSX parsers handle it. This is the only parseAmount implementation missing 마이너스 support.

### F-03: Server PDF fallback line scanner missing "마이너스" in fallbackAmountPattern (MEDIUM)
`packages/parser/src/pdf/index.ts` line 293: The fallbackAmountPattern regex doesn't include a capture group for "마이너스"-prefixed amounts. Even though the server PDF's main parseAmount doesn't handle 마이너스 (F-02), the regex should still match these amounts so they can be parsed after F-02 is fixed.

### F-04: Test coverage gaps for web PDF fallback amounts (MEDIUM)
No existing tests cover the web PDF fallback amount parsing with group 3 amounts (plain comma amounts without Won sign). Adding tests would have caught F-01.

## Deferred Items
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV adapter factory refactor | Requires shared module architecture |
| D-02 | PDF multi-line header support | Requires header row merging logic |
| D-03 | Server/web CSV parser dedup | Architecture refactor needed |

## Regressions
None expected. All changes are additive bug fixes.