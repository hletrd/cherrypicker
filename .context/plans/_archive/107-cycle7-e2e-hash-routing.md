# Plan 107 — Cycle 7 E2E Freshness and Hash Routing

**Findings:** C7-012 (Medium/High), C7-014 (Medium/High)
**Status:** completed
**Deploy mode:** none
**Archived after:** Cycle 8 review

## Evidence

- `e2e/core-regressions.spec.js` imports compiled matcher, constraints, and
  greedy optimizer modules but checks source freshness for the matcher only.
- `/cards/#main-content` focuses the landmark, then `CardPage` treats the hash
  as a card ID and replaces the list with a not-found alert.

## Outcome

Direct Playwright cannot silently use stale compiled core code, and document
landmark hashes can never enter the card-detail selection channel.

## Implementation

1. Replace the single matcher mtime check with a recursive core package
   source/dist freshness guard (or build provenance hash) covering every
   imported module and dependency. Fail with one actionable build command
   when any source lacks a fresh compiled peer.
2. Namespace hash-based selection as `#card=<encoded-id>` and parse only that
   form. Treat landmark and unknown hashes as list state; do not issue a detail
   fetch or replace list content.
3. Preserve valid detail deep links, browser back/forward behavior,
   breadcrumbs, focus, base-path formatting, and retry actions.
4. Extend the existing skip-link E2E assertion through post-hash rendering.

## Tests

- Runner-level freshness regression where only optimizer source is newer or a
  compiled peer is absent.
- Unit/component routing tables for empty, `#main-content`, valid namespaced,
  malformed, encoded, and unknown hashes.
- Browser skip-link test: focus reaches main, card-list heading/grid remain,
  no detail request occurs, and no alert appears.
- Valid detail navigation and back-to-list regression.

## Acceptance

- [x] Direct Playwright refuses every stale core source/dist graph.
- [x] `#main-content` remains a landmark, never a card selection.
- [x] Valid namespaced detail links and history behavior still work.
- [x] The keyboard skip link leaves the card list visible and error-free.

## Completion evidence

- Direct E2E recursively requires a fresh JavaScript peer for every core
  TypeScript source; optimizer-stale and missing-peer fixtures pass.
- Card selection uses only `#card=<encoded-id>` and validates the summary
  candidate under generation ownership. Landmark, malformed, legacy, and
  unknown hashes remain list state.
- The integration sweep migrated every existing detail E2E deep link and
  added a skip-link assertion that no detail request occurs before selection.

## Execution note

`ralph` is unavailable. Prompt 3 uses unit routing tables before one safely
owned browser regression run.
