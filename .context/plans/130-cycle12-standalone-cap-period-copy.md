# Plan 130 — Cycle 12 Standalone Cap Period Copy

**Finding:** C12-002 (`C12-CR-002`, Low/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Standalone HTML flattens `capsHit` correctly but hardcodes `월 한도` for
  every cap type.
- A real `per_transaction` event therefore claims that a monthly limit was
  reached even though later purchases remain independently eligible.

## Outcome

Standalone reports name each cap's real period and retain the existing cap
amount and lost-benefit disclosure.

## Implementation

1. Add a red visualization test covering `per_transaction`,
   `monthly_category`, and `monthly_total` events.
2. Introduce one Korean cap-type label helper at the standalone report
   boundary.
3. Render per-purchase, category-monthly, and card-total-monthly copy without
   changing calculation or telemetry.
4. Retain HTML escaping, amount formatting, ordering, and repeatable
   per-transaction events.

## Acceptance

- [x] `per_transaction` is never called a monthly cap.
- [x] Both monthly cap types remain clearly identified as monthly.
- [x] Cap amount and lost-benefit text remain accurate and escaped.
- [x] Existing terminal and standalone report tests stay green.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual red→implement→focused-green→repository-gates fallback. No deployment is
permitted.

## Completion evidence

- Red: two of three period-specific visualization assertions failed against
  the hardcoded monthly label.
- Green: all 23 visualization tests passed with `건당 한도`,
  `카테고리별 월 한도`, and `카드 월 통합 한도`.
- Commit:
  `6ab9416a539b50fdc31079440fa53988ec0c4642`
  (`🐛 fix(viz): label cap periods accurately`).
