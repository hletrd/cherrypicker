# Plan 83 — Cycle 3 UI Focus, Reflow, Localization, and Visual Regressions

**Findings:** C3-025, C3-026, C3-027, C3-028
**Deploy mode:** none
**Status:** completed

## Outcome

Keep keyboard context through card list/detail transitions, eliminate narrow
viewport overflow, localize the Korean accessibility tree, and turn a curated
stable subset of visual captures into an actual regression signal.

## Tasks

- [x] When card detail replaces the grid, update the document title and move
  focus to a temporarily focusable detail heading. Preserve the originating
  card ID and restore its focus on in-app return and browser back/forward.
- [x] Add keyboard E2E coverage for Enter → detail heading focus → return →
  originating card focus, including hash navigation and title assertions.
- [x] Match the home hero breakout to mobile container padding
  (`-mx-4`/`px-4` before the `sm` breakpoint or an equivalent bounded
  full-bleed wrapper). Assert root `scrollWidth === clientWidth` at 320, 375,
  and 400 px.
- [x] Replace the English breadcrumb landmark name with natural Korean copy
  (for example, `이동 경로`) and assert it in the accessibility tree.
- [x] Promote a small deterministic, high-value subset of screenshot scenarios
  to assertions with committed baselines, disabled animation/caret, stable
  fonts/data, and documented tolerances. Keep broad manual captures separate.
- [x] Include the curated visual assertions in the blocking regression
  configuration/CI gate and publish Playwright diffs on failure. Do not make
  unrelated antialiasing churn a blocker.
- [x] Replace remaining fixed sleeps in touched visual paths with observable
  DOM/font/layout readiness.

## Acceptance

- [x] Keyboard focus and title identify the current card detail, and returning
  restores the initiating control.
- [x] Home, dashboard, results, report, and card screens have no root overflow
  at 320/375/400 px.
- [x] The Korean accessibility snapshot contains no English breadcrumb label.
- [x] A deliberate CSS change to a curated surface fails a pixel/layout
  assertion and produces an inspectable diff.
- [x] Blocking E2E remains deterministic and repository-owned browser/preview
  processes are cleaned after the run.

## Coverage

| Finding | Completion evidence |
|---|---|
| C3-025 | focus/title/return-origin browser assertions |
| C3-026 | narrow-viewport root-overflow matrix |
| C3-027 | Korean landmark accessible-name assertion |
| C3-028 | curated committed baselines in the blocking gate |

## Completion evidence

- `bun run test:e2e` passed all 90 browser regressions with the committed
  375 px home-hero and desktop card-tile baselines.
- Click, browser back/forward, and in-app return assertions prove detail-heading
  focus, document-title updates, and one-shot origin-card focus restoration.
- The overflow matrix covers home, dashboard, results, report, card grid, and
  card detail at 320, 375, and 400 px.
- Both committed baselines were visually inspected. A temporary test-only
  8 px border mutation caused exactly the two curated visual assertions to fail
  while the other 88 E2E tests passed, and emitted expected/actual/diff PNGs.
  The mutation was then removed and the baselines were left unchanged.
- Every preflight and post-run ownership audit was clean and port 4173 was
  available. No unrelated browser or preview process was signalled.
- No deployment was performed.
