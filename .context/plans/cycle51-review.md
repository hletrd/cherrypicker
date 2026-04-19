# Cycle 51 Review Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle51-comprehensive.md`

---

## Review Summary

No new findings were identified in cycle 51. All previously identified issues are either:

1. **Fixed and verified:** C47-L01, C47-L02 (terminal `formatWon`/`formatRate` guards)
2. **Resolved this cycle (were already fixed or were false positives):**
   - C7R-M01 -- FALSE POSITIVE (Map was always keyed by `categoryKey`, not `tx.category`)
   - C7R-L01 -- Already fixed (`_bank` underscore prefix present)
   - C7R-L02 -- Already fixed (lint/typecheck gates pass)
   - C7R-L03 -- Already fixed (NaN guards present in `formatDateKo`/`formatDateShort`)
3. **Actively deferred with documented rationale:** D-106, D-107, D-110, C4-06, C4-07, C4-09, C4-10, C4-11, C4-13, C4-14

---

## Status of Prior Plans

| Plan | Status |
|---|---|
| `cycle7-re-review-fixes.md` | ARCHIVED -- all 4 tasks resolved (1 false positive, 3 already fixed) |
| `cycle47-fixes.md` | DONE -- both tasks implemented and verified |
| `cycle48-review.md` | DONE -- no implementation tasks |
| All prior cycle plans | DONE or archived |

---

## Deferred Items (Active)

The following deferred items remain from prior reviews. No new items added this cycle.

| ID | Severity | File | Description | Reason for Deferral |
|---|---|---|---|---|
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` | Bare `catch {}` in `tryStructuredParse` | Low severity; server-side equivalent correctly catches only specific errors; web-side has multiple fallback tiers |
| D-107 | LOW | `packages/parser/src/csv/index.ts:60-63` | `catch { continue; }` doesn't collect errors into ParseResult | Partially addressed by C46-L02 (now logs warnings); full fix would require API change to accumulate errors |
| D-110 | LOW | Store/UI | Non-latest month edits have no visible optimization effect | By design: optimization only covers the latest month; non-latest edits only affect previousMonthSpending |
| C4-06 | LOW | SavingsComparison | Annual savings projection label unchanged | Low severity; label is informative |
| C4-07 | LOW | SpendingSummary | localStorage vs sessionStorage inconsistency | Low severity; both are used for different purposes |
| C4-09 | LOW | CategoryBreakdown | Hardcoded `CATEGORY_COLORS` map | Cosmetic; missing categories fall through to uncategorized gray |
| C4-10 | MEDIUM | E2E tests | E2E test stale dist/ dependency | E2E tests not in critical path |
| C4-11 | MEDIUM | Core | No regression test for findCategory fuzzy match | Test gap but existing tests cover optimizer |
| C4-13 | LOW | CategoryBreakdown | Small-percentage bars nearly invisible | Cosmetic |
| C4-14 | LOW | Layout | Stale fallback values in footer | Low severity |

---

## No Implementation Tasks This Cycle

All findings from the cycle 51 review are either already fixed, resolved (false positives), or actively deferred. No code changes are needed.
