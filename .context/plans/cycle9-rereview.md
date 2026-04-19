# Plan -- Cycle 9 Re-Review Findings

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle9-re-review.md`
**Status:** All findings deferred (LOW severity, domain-appropriate tradeoff)

---

## Review Summary

One new finding identified: C9R-01 (date validation day-range accuracy). This is a LOW severity finding that extends the same `day <= 31` validation pattern already addressed in cycles 31, 32, and 34. The 31-day ceiling was chosen intentionally as domain-appropriate for bank statement parsing.

---

## Finding: C9R-01 -- Date validation uses `day <= 31` instead of month-specific day limits

- **Severity:** LOW
- **Confidence:** HIGH
- **Decision:** DEFERRED

### Reason for deferral

1. **Domain appropriateness:** Bank statements never contain invalid calendar dates like February 31. The `day <= 31` check is sufficient for the input domain.

2. **Prior review coverage:** This was already addressed in cycles 31, 32, and 34 where month/day range validation was added to all `parseDateToISO` implementations. The `day <= 31` ceiling was the chosen validation level -- per-month day limits were considered but rejected as over-engineering for this domain.

3. **No downstream impact:** Invalid date strings like `2026-02-31` are handled opaquely by all downstream code. The optimizer treats dates as opaque strings. Display functions (`formatDateKo`, `formatDateShort`) would render them as-is. No arithmetic is performed on the dates.

4. **False positive risk:** Adding per-month validation would require either a lookup table or `Date` object construction, adding complexity for a case that never occurs in practice.

### Exit criterion

This finding would be re-opened if:
- A user reports a statement with invalid dates that passes parsing and causes downstream issues
- Future code adds date arithmetic that would produce incorrect results from invalid date strings
- The parser is repurposed for non-bank-statement input where invalid dates are more likely

---

## Prior Plans Status

All prior cycle 9 plans are DONE:
- `16-high-priority-cycle9.md` -- C9-05, C9-01 -- DONE
- `17-medium-priority-cycle9.md` -- C9-03, C9-11, C9-13 -- DONE

All prior cycle 31-34 date validation plans are DONE:
- `c31-01-test-date-validation.md` -- DONE
- `c32-full-date-range-validation.md` -- DONE
- `c34-csv-adapters-date-validation.md` -- DONE
- `c34-pdf-date-validation.md` -- DONE
- `c34-xlsx-date-validation.md` -- DONE

---

## No Implementation Tasks This Cycle

The only new finding (C9R-01) is deferred with documented rationale. All prior findings are either fixed or already deferred. No code changes are needed.
