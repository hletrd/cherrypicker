# Cycle 10 Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle10-comprehensive.md`

---

## Review Summary

One genuinely new finding identified in cycle 10. All prior findings verified as either fixed or already deferred.

---

## Task 1: Add `Number.isFinite` guard to XLSX `parseDateToISO` numeric path

- **Finding:** C10-03 (LOW, MEDIUM confidence)
- **File:** `apps/web/src/lib/parser/xlsx.ts:193-203`
- **Problem:** `parseDateToISO` handles `typeof raw === 'number'` but only checks `raw < 1 || raw > 100000`. This rejects NaN (falls through to `parse_date_code(undefined)`) but `Infinity` passes the guard since `Infinity > 100000` is true, causing it to return `String(Infinity)` = "Infinity" as a date string.
- **Fix:** Add `Number.isFinite(raw)` to the numeric guard:
  ```ts
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 1 || raw > 100000) return String(raw);
    // ... rest of serial date handling
  }
  ```
- **Verification:** After the fix, `parseDateToISO(Infinity)` should return "Infinity" (a harmless string that won't match any date pattern downstream), and `parseDateToISO(NaN)` should still return "NaN" (same behavior as before, caught by downstream validation).
- **Status:** ALREADY FIXED (commit `000000022e fix(parser): 🛡️ guard against Infinity/NaN in XLSX date parsing`)

---

## Deferred Items (carried forward, no changes)

All 18 deferred findings from the aggregate remain unchanged. No new deferred items this cycle.

---

## Status of Prior Plans

| Plan | Status |
|---|---|
| `cycle51-review.md` | DONE -- no implementation tasks |
| All prior cycle plans | DONE or archived |
