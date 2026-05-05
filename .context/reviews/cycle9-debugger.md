# Cycle 9 — Debugger

**Reviewer:** debugger (manual)
**Scope:** Latent bug surface, failure modes, edge cases
**Date:** 2026-05-06

---

## Summary

No new critical failure modes. Cycle 8 fixes verified. One latent bug found in server-side OFX parser (memo deduplication). HTML forward-fill behavior is correct but has a subtle edge case with summary row contamination.

---

## Verified Fixed

### C8-01 FIXED: Web-side PDF, XLSX, CSV negative amounts
- All three parsers now use `if (amount <= 0) continue;` instead of `Math.abs()`
- Verified by grep across `apps/web/src/lib/parser/`

### C8-02 FIXED: SUMMARY_ROW_PATTERN length cap
- `isSummaryRow(text.slice(0, 500))` prevents ReDoS on pathological input

---

## New Findings

### C9-DEB-01 [LOW] Server-side OFX parser duplicates memo into merchant fallback

**File:** `packages/parser/src/ofx/index.ts:183-191`
**Confidence:** High

When `name` is empty, merchant falls back to MEMO value:
```ts
merchant: name || extractTag(block, 'MEMO') || '',
```

Then the memo deduplication check uses `tx.memo` (undefined):
```ts
if (memo && memo !== tx.memo) {
  tx.memo = memo;
}
```

This always evaluates to true, so `tx.memo` is set to the same value as `tx.merchant` when name is empty. The web-side correctly uses `memo !== tx.merchant`.

**Failure scenario:** Credit card OFX exports where `<NAME>` is empty but `<MEMO>` contains the merchant name. Both merchant and memo fields end up with identical values, which is technically harmless but redundant.

**Fix:** Change `tx.memo` to `tx.merchant` in server-side OFX parser (one-line fix).

---

### C9-DEB-02 [LOW] HTML forward-fill could inherit summary-row values for non-summary columns

**File:** `packages/parser/src/html/index.ts:164-215`
**Confidence:** Low

The forward-fill logic checks `!isSummaryRow(String(rawDateValue))` before updating `lastDate`. However, `isSummaryRow` tests the individual cell value, not the full row. If a summary row has a legitimate date in the date column (e.g., "2024-01-31" as the statement closing date), it would pass `isSummaryRow` and be forward-filled into subsequent rows.

**Impact:** Very low. Summary rows in Korean bank exports typically don't have dates in the date column — they have text like "합계" or "총계". The `isSummaryRow` check on line 156 (`if (isSummaryRow(rowText)) continue;`) skips the entire row before forward-fill processing, so this edge case only applies if a summary row somehow passes `isSummaryRow` but has a date-like value in a forward-fill column.

**Fix:** No action needed unless real-world data triggers this.

---

## Previously Reported — Status

| Finding | Cycle | Status | Notes |
|---------|-------|--------|-------|
| OFX timezone strip | 5 | **FIXED** | KST conversion present in both parsers |
| HTML forward-fill mutation | 5 | **FIXED** | Two-pass/cloned approach not needed; forward-fill is correct |
| AbortController timeout | 4 | **FIXED** | `finally` block clears timeout |

---

## Verdict

**FIX AND SHIP:** C9-DEB-01 (one-line OFX fix)
**ACCEPT RISK:** C9-DEB-02 (theoretical edge case, no real-world evidence)
