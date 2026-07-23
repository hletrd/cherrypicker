# Plan 111 — Cycle 8 Composable Card Navigation State

**Findings:** C8-009 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Card selection is encoded as `#card=<id>` while the global skip link writes
  `#main-content`.
- The card page listens to hash changes and clears selection for every
  non-card fragment, so activating the document landmark from a detail view
  closes that detail.

## Outcome

Card application state and document fragment navigation are independently
addressable: landmark focus never changes the selected card, while deep links,
history, base-path formatting, and no-JavaScript landmarks remain coherent.

## Implementation

1. Move card selection to one validated query parameter and reserve the URL
   fragment exclusively for document landmarks. Centralize parse/build helpers
   and preserve unrelated query parameters and fragments.
2. Drive selection from initial URL plus `popstate`; update history on
   selection/back without synthesizing hash events. A skip-link fragment must
   compose with, not replace, the selected-card query state.
3. Preserve candidate validation, loading/error/retry behavior, breadcrumbs,
   focus restoration, encoded IDs, Pages base paths, and direct detail links.
   Treat malformed/unknown selection parameters as list state without issuing
   an invalid detail fetch.
4. Migrate unit, component, and E2E links from hash selection to query
   selection and add the detail-plus-skip-link regression.

## Tests

- URL tables for no selection, valid/encoded/malformed/unknown card queries,
  unrelated query parameters, `#main-content`, and combined query+fragment.
- Back/forward and select/back component tests with exact history semantics and
  request counts.
- Browser regression: open a detail, invoke the keyboard skip link, confirm
  focus reaches `main`, detail content remains, URL contains both channels,
  and no duplicate detail fetch occurs.

## Acceptance

- [x] Document fragments never mutate selected-card application state.
- [x] Detail links, browser history, and Pages base paths remain valid.
- [x] Invalid selection state fails to the list without a spurious fetch.
- [x] Keyboard skip navigation works from both list and detail views.

## Completion evidence

- Card selection now uses one validated `card` query parameter while the hash
  remains reserved for landmarks. URL builders preserve base paths, unrelated
  query state, and fragments.
- Initial selection and `popstate` drive detail state; invalid/duplicate card
  parameters return to list state without a detail request.
- The skip link preserves selection and explicitly focuses the main landmark,
  including repeated activation of an existing fragment.
- Navigation-focused tests passed 52 checks and the final regression E2E gate
  passed all 96 browser tests.

## Execution note

`ralph` is unavailable. Prompt 3 will use routing-table tests first and one
strictly owned browser regression after implementation.
