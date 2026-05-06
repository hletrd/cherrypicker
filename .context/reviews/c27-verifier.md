# Cycle 27 — Verifier Review

## Summary
Verification of cycle 26 fixes and cross-parser consistency checks.

---

## Cycle 26 Fixes Verified

| Fix | Status | Evidence |
|-----|--------|----------|
| C26-COR01: Redundant branch removed | VERIFIED | `packages/core/src/calculator/reward.ts:260-272` now has single `if (rate)` branch |
| C26-COR02: JSON negative amounts | VERIFIED | Both server and web JSON parsers use `if (amount <= 0) return null` |
| C26-COR03: Analyzer unsafe assertion | VERIFIED | `apps/web/src/lib/analyzer.ts:367-368` uses `?? 0` |
| C26-COR04: PDF regex capture group | VERIFIED | `apps/web/src/lib/parser/pdf.ts:626` uses `dateMatch[0]` |
| C26-TEST02: Combined rate+fixed test | VERIFIED | `packages/core/__tests__/calculator.test.ts` has combined fixture |

---

## New Verification Findings

### C27-VER01: Server/web XLSX parsers lack summary-row forward-fill reset

**Files:** `packages/parser/src/xlsx/index.ts:325`, `apps/web/src/lib/parser/xlsx.ts:484`
**Confidence:** High

Verified by code inspection: both XLSX parsers use `if (isSummaryRow(rowText)) continue;` without resetting forward-fill state. The HTML parsers (both server and web) DO reset forward-fill state before continuing. This inconsistency is a parity gap.

### C27-VER02: Web-side parseAmount is duplicated between csv.ts and pdf.ts

**Files:** `apps/web/src/lib/parser/csv.ts:123-151`, `apps/web/src/lib/parser/pdf.ts:246-274`
**Confidence:** High

Line-by-line comparison shows the two functions differ only in:
- Export keyword (pdf.ts exports, csv.ts doesn't)
- Comment text
- The csv.ts version has `parseCSVAmount` and `parseAmountString` aliases

The actual parsing logic is identical. This is verified duplication.
