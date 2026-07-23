# Plan 88 - Cycle 4 UI and Browser Regressions

**Findings:** C4-013, C4-018, C4-019, C4-020, C4-021, C4-022, C4-026, C4-027
**Status:** completed
**Archived:** 2026-07-23 during Cycle 5 planning
**Deploy mode:** none

## Outcome

Keep dashboard information inside its containers at tablet widths, make
disclosures and badges accessible, shorten mobile catalog navigation, suppress
empty print actions, preserve visible focus after mobile filter collapse, and
turn named browser tests into deterministic proofs.

## Tasks

- [x] Delay the dashboard top-row two-column breakpoint until both child cards
  satisfy measured minimum widths, or make the children respond to their
  container size. Keep summary amounts and all category columns visible without
  root or panel overflow at 767, 768, 900, 1024, and 1100 px.
- [x] Separate persistent category `expandedIndex` from transient hover/focus
  emphasis. Bind disclosure visibility and `aria-expanded` only to activation;
  first Enter/click opens and second activation closes.
- [x] Centralize semantic badge color pairs and raise dark-mode credit,
  prepaid, and high-confidence small text to at least 4.5:1 contrast while
  retaining clear light-mode distinctions.
- [x] Reduce catalog depth with a stable viewport-independent page size,
  pagination/range controls above and below the grid, and a compact accessible
  mobile issuer-filter disclosure. Preserve query/history state, clamping, and
  focus behavior after filtering.
- [x] After a mobile issuer selection collapses its options, hand focus to the
  visible issuer disclosure toggle without changing query, history, or filter
  behavior.
- [x] Hide the print/PDF action when report data is absent, or expose it as a
  genuinely disabled control with an adjacent explanation. Ensure activation
  cannot call `window.print` or enter print mode in the empty state.
- [x] Replace all five fixed two-second waits in
  `e2e/ui-ux-review.spec.js` with observable catalog, route, layout, and
  application-settled conditions.
- [x] Make search record an unfiltered baseline, use a known unique query, and
  assert changed count and visible identity. Make card detail visibility,
  click, hash, heading, and card-specific content unconditional.
- [x] Replace elapsed error-listener windows with deterministic readiness and a
  controlled post-settle observation mechanism. Keep the home and populated
  dashboard listeners active through a named two-frame console sentinel.
- [x] Add blocking geometry, keyboard, computed-contrast, mobile-pagination,
  and empty-print regressions.

## Acceptance

- [x] Root and both dashboard panels satisfy
  `scrollWidth === clientWidth` at 767, 768, 900, 1024, and 1100 px, with the
  primary amount and every category amount/percentage inside their cards.
- [x] A focused collapsed category remains collapsed until the first
  activation; first activation opens and second activation closes for keyboard
  and pointer paths.
- [x] Every tested light/dark small-text badge pair reaches 4.5:1.
- [x] At 320 by 568, current range and pagination are available before the card
  grid, no page renders 36 cards, and issuer filters do not occupy an always-open
  multi-screen block.
- [x] Selecting a mobile issuer collapses the options and leaves focus on the
  visible issuer disclosure toggle rather than a hidden option.
- [x] Empty report activation cannot print; restored report data makes the
  action available.
- [x] The named search and detail tests cannot pass without proving their
  behavior, and the home/dashboard runtime tests cannot pass without observing
  their post-settle frame sentinel. None contains a fixed timeout.
- [x] Web unit, accessibility, type, build, curated visual, and full blocking
  E2E gates pass with owned process cleanup.

## Coverage

| Finding | Required evidence |
|---|---|
| C4-013 | deterministic search/detail E2E assertions with no fixed waits |
| C4-018 | tablet root/panel geometry matrix |
| C4-019 | focus plus first/second activation disclosure sequence |
| C4-020 | computed light/dark semantic badge contrast matrix |
| C4-021 | compact mobile filters and before/after-grid pagination assertions |
| C4-022 | empty/restored report print-state test |
| C4-026 | post-collapse visible-focus handoff to the mobile issuer toggle |
| C4-027 | named home/dashboard runtime listeners held through a two-frame post-settle sentinel |

## Expected implementation surface

- `apps/web/src/pages/dashboard.astro`
- `apps/web/src/components/dashboard/SpendingSummary.svelte`
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte`
- card grid/detail and transaction badge styles or one shared semantic token
- `apps/web/src/lib/card-grid-state.ts`
- `apps/web/src/components/cards/CardGrid.svelte`
- `apps/web/src/pages/report.astro` and visibility/print state helpers
- focused web unit/component tests
- `e2e/ui-ux-review.spec.js` and existing accessibility/geometry specs
- this plan for completion evidence

Browser runs must use the repository-owned E2E runner and its exact cleanup
protocol. No deploy, commit, or push work belongs to this plan.

## Implementation progress

- Dashboard top panels now wait for the measured 1100 px breakpoint, and
  geometry probes cover root/panel widths plus primary/category values at 767,
  768, 900, 1024, and 1100 px.
- Category hover/focus emphasis is separate from activation-only disclosure
  state. Semantic badge tokens cover catalog, detail, reward, and
  high-confidence variants in light and dark modes.
- The catalog uses a stable 12-card page, named top/bottom pagers, and a
  collapsed mobile issuer control while retaining query/history state. Mobile
  issuer selection now waits for the collapse commit and returns focus to the
  visible disclosure toggle.
- Empty report print is hidden, disabled, and rejected by the print controller;
  restored report state re-enables it.
- `e2e/ui-ux-review.spec.js` contains no fixed waits or conditional search,
  detail, results-empty, or error-observation passes. Its named home and
  populated-dashboard runtime proofs keep the error listeners active until a
  deterministic two-frame console sentinel is observed. The accessibility
  suite now contains the required geometry, interaction, computed-contrast,
  mobile, and print regressions.
- Focused UI tests: 13 passed. Final `astro check`: 97 files with 0 errors,
  warnings, or hints. The complete web and workspace test gates passed after
  generated catalog refresh.
- Targeted gate repairs passed 5/5 for deterministic application readiness and
  2/2, then 6/6 repeated, for tablet/mobile assertions. Playwright `--list`
  collected the complete suite with no focused markers.
- The focused card-grid unit regression verifies the visibility guard,
  post-collapse render tick, and toggle focus handoff. The mobile browser
  regression now requires the visible disclosure toggle to own focus after an
  issuer selection.
- The C4-027 test file passes `node --check`; Playwright discovery lists all 58
  tests in the file, including both named post-settle runtime proofs, with no
  focused markers and without starting a browser.
- The final exact repository-owned browser gate passed 93/93 after the C4-026
  focus and C4-027 post-settle assertions were added, with no test or color
  warnings. Immediate postflight confirmed no owned run, listener, browser, or
  preview remained. Interactive Chrome and other-workspace process trees were
  not signalled.
