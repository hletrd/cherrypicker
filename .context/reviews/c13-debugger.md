# Debugger — cherrypicker (Cycle 13)

**Reviewer:** debugger
**Date:** 2026-05-05

---

## Summary

One C12 finding retracted as false positive. One new latent bug discovered in PDF fallback parsing. The codebase's defensive filtering prevents the new bug from causing visible user impact in most cases.

---

## Retracted Finding

### C12-DB03: RETRACTED — `dateMatch[1]` is valid, pattern HAS capture groups

**File:** `apps/web/src/lib/parser/pdf.ts:554`
**Previous assessment:** `dateMatch[1]` is `undefined` because `fallbackDatePattern` has no capture groups.
**Re-examination:** The pattern `/(\d{4}[...]|\d{2}[...]|...)/` has an OUTER capture group around the entire alternation. Therefore `dateMatch[1]` contains the matched date string, not `undefined`. The non-null assertion at line 618 (`dateMatch[1]!`) is correct. C12-DB03 was a false positive.

---

## New Findings

### C13-DB01: PDF fallback trailing-minus amounts parsed as positive (MEDIUM)

**File:** `apps/web/src/lib/parser/pdf.ts:565, 604`
**Confidence:** High

The `fallbackAmountPattern` group 6 `([\d,]*(?:,|\d{5,})[\d,]*)-` places the trailing `-` OUTSIDE the capture group. `amountMatch[6]` gets only the digits (e.g., `"1,234"`). `parseAmount()` then receives the digits without the minus, so its trailing-minus detection (`/\d-$/`) fails. The amount is treated as positive spending instead of a refund.

**Impact:** The fallback path is only reached when structured table parsing fails. In that path, a transaction with a trailing-minus amount (refund) would be incorrectly included as positive spending. This affects optimization accuracy for PDF files from banks that use trailing-minus format.

**Fix:** Change group 6 to `([\d,]*(?:,|\d{5,})[\d,]*-)` to include the minus in the captured text.

---

## Re-confirmed (no change)

| ID | Severity | Description |
|---|---|---|
| C12-DB01 | LOW | `reoptimize` monthlyBreakdown recalculation — confirmed correct |
| C12-DB02 | LOW | `scoreCardsForTransaction` push/pop — safe in single-threaded JS |

---

## Gate Evidence

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS
- `npx vitest run` — PASS
