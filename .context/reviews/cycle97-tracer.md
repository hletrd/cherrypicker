# Cycle 97 — tracer pass

**Date:** 2026-04-23

## Scope

Competing-hypothesis causal trace of the "malformed statement period display" class of bug.

## Hypothesis space

H1: C96-01 covers this already (the `months.length === 0` throw).
H2: The unparseable dates are filtered by `.filter(Boolean)` before sort.
H3: `formatPeriod()` gracefully handles malformed inputs with no user-visible artifact.
H4: The `allDates` unfiltered sort pipeline produces malformed start/end values, and the UI displays a malformed "- ~ X" or "X ~ -" combo.

## Evidence gathered

For H1: FALSIFIED. C96-01 throws only when `months.length === 0`, meaning every row was unparseable. With one bad row mixed among good rows, `months.length > 0` and execution proceeds.

For H2: FALSIFIED. `.filter(Boolean)` only filters empty strings and falsy values. A non-empty malformed string like `"2026-"` or `"소계"` passes through.

For H3: PARTIALLY TRUE. `formatYearMonthKo()` (formatters.ts:161-168) does handle malformed inputs by returning `'-'`. `formatPeriod()` (SpendingSummary.svelte:44-50) returns `'-'` if either start or end is `'-'`. So the display is NOT blank — it's either `'-'` (both sides unparseable) or the combined `"- ~ X"` (one side unparseable). That's actually WORSE than pure `'-'` because it looks like a half-valid range, confusing the user.

Wait — re-reading formatPeriod: `if (startStr === '-' || endStr === '-') return '-';` — so if EITHER side is '-', the entire period collapses to '-'. That's actually a graceful degradation. So H3 is TRUE — the UI is not showing malformed output; it's showing `'-'`.

For H4: PARTIALLY FALSIFIED. The UI does NOT show "- ~ X". It shows `'-'` thanks to the early return in `formatPeriod`. BUT the `fullStatementPeriod` object in the store still contains the malformed strings. If any other component consumes `fullStatementPeriod.start/end` directly without going through `formatPeriod`, it would see the malformed values.

## Audit of consumers of fullStatementPeriod

- `SpendingSummary.svelte:109` — via `formatPeriod()` which gracefully degrades to `'-'`. Safe.
- `ReportContent.svelte:9,17-19` — via `statementPeriod` (not `fullStatementPeriod`), and `formatYearMonthKo` which handles malformed input. Safe.
- Store (persistence) `store.svelte.ts:155,299` — passes through JSON without inspection. Safe but contaminates persisted state.

**Conclusion.** H4 is largely falsified by the formatPeriod graceful-degradation logic. The impact of C97-01 is lower than initially estimated: the UI renders `'-'` rather than a confusing partial range. However:
1. The fullStatementPeriod object contains garbage data (pollutes sessionStorage).
2. If a future consumer bypasses `formatPeriod`, the bug reappears.
3. The graceful degradation silently hides the underlying data corruption.

So C97-01 remains a real finding, but severity is LOW (previously rated LOW in code-reviewer — aligned).

## Summary

1 finding (C97-01 shared). Severity confirmed LOW after tracing. Fix is defense-in-depth plus avoids polluting sessionStorage with invalid dates.
