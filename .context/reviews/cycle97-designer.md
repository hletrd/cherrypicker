# Cycle 97 — designer pass

**Date:** 2026-04-23

## Scope

UI/UX review focus on the analysis period display and related dashboard cards.

## Findings

None net-new.

## Observations

- `SpendingSummary.svelte:102-111` "분석 기간" card uses `formatPeriod()` which gracefully falls back to `'-'` when either bound is malformed (C97-01). This is acceptable UX degradation — the user sees a clear absence of data rather than garbled text.
- Would it help to surface a warning when the period collapses to `'-'` despite transactions being present? Arguably yes, but this is a small UX polish not a bug. Not adding in this cycle.
- WCAG AA contrast (C1-03/C90-02) fixes remain in place via `getIssuerTextColor` helper (formatters.ts:150-153). Verified for kakao (yellow background + dark text) and jeju (orange background + dark text).

## Summary

No net-new designer findings. The C97-01 fix will have no user-visible change for the graceful-degradation path; it's a defense-in-depth fix that removes garbage from the store state.
