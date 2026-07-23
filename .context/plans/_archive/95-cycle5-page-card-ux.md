# Plan 95 — Cycle 5 Page, Report, and Card UX

**Findings:** C5-024, C5-025, C5-029, C5-030, C5-032, C5-033, C5-034, C5-035, C5-036, C5-037
**Status:** complete
**Deploy mode:** none

## Outcome

Card details use human labels, result pages have stable readiness and
navigation semantics, print output excludes controls, pagination preserves
context, theme/native controls expose coherent state, and decorative motion or
links do not promise unavailable behavior.

## Implementation

1. Localize known card exclusion identifiers and provide a safe human-readable
   fallback for future identifiers.
2. Replace failing SpendingSummary foregrounds with verified semantic tokens.
3. Give dashboard, results, and report a stable hydration/readiness shell with
   distinct loading, error, no-data, and data states and appropriate status
   text.
4. Hide navigation/action/sort/disclosure controls from print and define
   whether useful details expand in print.
5. After bottom pagination, move focus/scroll context to the new result region
   or first card while respecting reduced-motion preferences.
6. Declare light/dark `color-scheme`; synchronize both theme buttons' state and
   action-specific accessible names.
7. Add a savings section heading on results, remove clickable lift from
   noninteractive panels, and preserve the issuer query when linking from
   “same issuer” content.

## Tests and evidence

- Localized exclusion and unknown-identifier fallback tests against shipped
  card details.
- Computed-style contrast in light/dark themes.
- Hydration tests for stored data, no data, and corrupted/error state without a
  false empty flash.
- Print stylesheet/snapshot assertions for all interactive controls.
- Keyboard/browser pagination context and reduced-motion tests.
- Theme button state/name, native color-scheme, results heading-tree, hover
  affordance, and issuer-query tests.
- Web unit, accessibility, lint, type, build, print, and E2E gates.

## Acceptance

- [x] No raw exclusion identifier is exposed as normal Korean UI copy.
- [x] Summary text meets 4.5:1 contrast.
- [x] Persisted routes never announce a false empty state before readiness.
- [x] Printed results contain no interactive-only chrome.
- [x] Bottom pagination preserves user context.
- [x] Native controls and theme buttons expose the active theme coherently.
- [x] Results headings, panel affordances, and same-issuer navigation match
  their visible promises.

## Evidence

- The complete web component suite passed 448 tests; the focused page, card,
  report, theme, print, and accessibility lane passed 40 tests.
- Tests cover localized exclusion fallbacks, stable hydration states,
  print-only expansion and control suppression, pagination focus, native
  color schemes, synchronized theme controls, heading structure, and
  issuer-preserving navigation.
- The exact E2E gate passed all 96 tests with a clean repository-owned process
  state before and after the run.
