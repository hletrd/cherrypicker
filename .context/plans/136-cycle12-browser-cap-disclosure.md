# Plan 136 — Cycle 12 Browser Cap Disclosure

**Finding:** C12-008 (`C12-CT-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- `capsHit` survives optimizer, worker, persistence, coherence, and store
  boundaries.
- Dashboard, results, and `ReportContent` never read or render it.
- A real `bc-baro-on-off` reward is clipped from 2,000 to 1,000 Won with no
  browser explanation, while terminal/standalone output discloses the event.

## Outcome

All browser result surfaces explain cap type, cap amount, and lost benefit
using the authoritative plural `capsHit` telemetry.

## Implementation

1. Add red component/page contracts using the real per-transaction fixture and
   plural same-category cap events from Plan 127.
2. Create a shared browser presentation helper/component for cap labels,
   amounts, and outcome copy.
3. Render cap disclosure on dashboard/results warnings and in
   `ReportContent`, preserving event order and repeatable events.
4. Use clear Korean period wording for `per_transaction`,
   `monthly_category`, and `monthly_total`.
5. Preserve legacy persistence decoding, current coherence validation,
   print/readiness behavior, and no-JavaScript static shells.

## Acceptance

- [x] Dashboard, results, and in-app/print report disclose every cap event.
- [x] Per-purchase and both monthly periods are distinguishable.
- [x] Applied reward and lost benefit match authoritative telemetry.
- [x] Multiple same-category and repeatable per-transaction events are not
      collapsed.
- [x] Worker/persistence compatibility remains unchanged.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual component-contract and focused-boundary fallback before full gates.
Browser tests will use only the repository-owned E2E runner with clean status
assertions. No deployment is permitted.

## Completion evidence

- Red: source/component contracts first exposed the missing browser sinks; an
  independent integration review then added a failing assertion for the
  omitted applied-reward value.
- Green: the shared ordered presentation renders card, category, period, cap
  amount, applied reward, and lost reward on dashboard, results, and report.
  Focused browser-boundary tests and Astro checks pass.
- Commit:
  `c1126fd9c89efae2049cc4e2b56be025a56a4774`
  (`✨ feat(web): disclose applied cap outcomes`).
