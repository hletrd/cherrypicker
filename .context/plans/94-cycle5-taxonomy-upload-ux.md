# Plan 94 — Cycle 5 Taxonomy and Upload UX

**Findings:** C5-009, C5-019, C5-020, C5-021, C5-022, C5-023, C5-026, C5-027, C5-028, C5-031
**Status:** complete
**Deploy mode:** none

## Outcome

Transaction editing always uses a complete, understandable taxonomy; running
analysis inputs cannot drift from their snapshot; upload and edit transitions
retain keyboard/assistive-technology context; and upload controls meet contrast
and input-format expectations.

## Implementation

1. Build fetched and fallback category options, group labels, label maps, and
   parent maps through one helper. Seed fallback state synchronously and
   replace parent `전체` option text with qualified group labels.
2. Disable the complete bank/previous-spending option fieldset while analysis
   is active and make its busy state explicit.
3. Preserve or deliberately hand off focus when a filtered edited row
   disappears. Make the transaction scroll container a labeled, focusable
   region with a visible focus ring and mobile scroll hint.
4. Replace failing upload step/retry colors with semantic foreground/background
   pairs verified at 4.5:1.
5. Add one persistent external upload status region. Restore focus after
   remove/clear/retry branch changes and replace the rushed success transition
   with an announced, deterministic destination/action.
6. Make previous-spending formatting and validation agree: use a valid example
   and revalidate touched input on edit/blur.

## Tests and evidence

- Component tests for fallback canonical pairs, qualified parent labels,
  synchronous options, and reward preservation.
- Busy-input snapshot tests and browser assertions for disabled controls.
- Keyboard tests for filtered-row focus handoff and transaction-region scroll.
- Token-level and computed-style contrast assertions in both themes.
- Upload focus/live-status/error/retry/success E2E coverage.
- Previous-spending comma/example, maximum, touch, and revalidation tests.
- Web unit, accessibility, lint, type, build, and E2E gates.

## Acceptance

- [x] Fallback and fetched taxonomy produce the same canonical category pair.
- [x] Every closed parent choice identifies its group.
- [x] Visible analysis options always match the running analysis snapshot.
- [x] No taxonomy or upload transition strands focus on a removed node.
- [x] Scrollable transaction content is keyboard reachable and named.
- [x] Upload text/action colors meet 4.5:1 in both themes.
- [x] Previous-spending guidance, accepted input, and errors stay consistent.

## Evidence

- The complete web component suite passed 448 tests; the focused taxonomy,
  upload, focus, and contrast lane passed 40 tests.
- Browser coverage verifies two filtered-row focus handoffs, keyboard
  horizontal scrolling, disabled in-flight options, upload status/retry
  transitions, and computed 4.5:1 contrast in light and dark themes.
- The exact E2E gate passed all 96 tests with a clean repository-owned process
  state before and after the run.
