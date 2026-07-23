# QA Tester — Cycle 3

**Reviewer:** qa-tester
**Date:** 2026-07-23
**Baseline:** `614ce5c`
**Disposition:** Core happy paths and the configured browser regression gate
pass. Two user-visible state-transition defects are confirmed; visual
regression detection remains manual.

## Product and release coverage inventory

The executed 84-test browser suite covers:

- home metadata, navigation, mobile menu, theme persistence, upload selection,
  bank controls, valid/invalid file handling, dashboard/results/report routes,
  card search/detail, empty states, session restoration, aggregate totals, and
  runtime error monitoring;
- page-wide drop, previous-spending bounds, partial-warning identity,
  card-loader retry, recommendation table/keyboard behavior, 320/375/400 px
  geometry, reduced motion, WCAG AA contrast, printing, and narrow tables;
- safe/unsafe external links, frame behavior, report CSP, catalog request
  boundaries, optimizer fact propagation, bounded storage migration, and
  nested-route skip links.

The 2,254 passing unit/script tests additionally cover all statement formats,
server/browser parser parity, malformed amounts/dates/encodings, calculator
caps/conditions, catalog semantics for all 683 cards, artifact identity,
network policy, writer containment, CLI consent, process ownership, workflow
pins/permissions, and build budgets.

The following product-state matrix was checked against source, tests, and safe
local boundary repros:

| Scenario | Current automated coverage | Current result |
|---|---|---|
| Normal CSV upload -> dashboard -> results -> report | E2E | Pass |
| Partial multi-file parse warning survives routes/reload | E2E | Pass |
| Corrupt/future persisted schema | unit + E2E | Pass/fails closed |
| Cancel active parser/PDF work | unit | Pass |
| Success A -> failed replacement B -> reload | None | Fail, C3-QA-001 |
| Drop B during A's success countdown | None | Fail, C3-QA-002 |
| Long scraper source with material tail section | None | Incomplete success |
| Invalid numeric entity in CLI report data | None | Report aborts |
| Existing symlink at CLI report destination | Wrong-mode unit only | Unsafe write |
| Terminal controls in catalog display fields | Helper only | Controls survive sink |

## Findings

### C3-QA-001 — Failed replacement analysis can reappear as a successful old result after reload

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `apps/web/src/lib/store.svelte.ts:335-384`;
  persistence initialization `:191-263`;
  missing scenario in `e2e/ui-ux-review.spec.js:632-663` and
  `e2e/web-regressions.spec.js:81-118`
- **Correlates with:** C3-DBG-001, C3-TE-004

**User scenario:** Upload A and reach the dashboard. Return home and submit
malformed B. The app reports B's failure and clears its in-memory result, but A
is still in `sessionStorage`; refresh or direct navigation restores A. A user
can reasonably interpret that dashboard as the result of the most recent
upload.

**Acceptance requirement:** Product must choose and consistently present one
policy. If “last good result” is retained, the failed attempt must not clear it
in memory and the UI must label it as older. If replacement clears prior data,
storage and every result route must stay empty after reload. Add browser
coverage for both malformed and network/catalog failure, while an explicit
abort must not surface an error.

### C3-QA-002 — A new file dropped during “complete” is discarded by the old navigation timer

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `apps/web/src/components/upload/FileDropzone.svelte:52-92,
  162-169,196-236,319-337,439-509`;
  missing scenario in `e2e/ui-ux-review.spec.js:163-236`
- **Correlates with:** C3-DBG-003, C3-TE-007

**User scenario:** During the 1.2-second “분석 완료” countdown for A, drop B
anywhere on the page. B appears and the form returns to idle, but A's still
current timer navigates to A's dashboard. No message says B was ignored.

**Acceptance requirement:** Either lock file admission during the transition
or treat it as an explicit cancellation of A's pending navigation. B must
remain selected, route and step indicators must agree, and no old result may
be presented as B. Test mouse drop and file-picker mutations with fake timers
and one real-browser path.

### C3-QA-003 — Screenshot checks capture artifacts but detect no visual differences

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed gate gap
- **Locations:** `playwright.config.ts:6-16`;
  `playwright.screenshots.config.ts:6-16`;
  `e2e/ui-ux-screenshots.spec.js:49-163`;
  `.github/workflows/deploy.yml:38-55`

The regression gate explicitly ignores the 13 screenshot-capture cases. The
separate suite writes PNG files with `page.screenshot`, but has no
`toHaveScreenshot` baselines or pixel/layout comparison. It is useful for
manual review, yet a spacing, clipping, theme, or responsive visual regression
cannot fail the deployment workflow unless it also violates a semantic or
geometry assertion.

**Failure scenario:** A CSS change preserves headings, roles, and the few
asserted geometry boundaries while visibly breaking a covered screen. All
configured release tests remain green and new captures are produced without a
comparison.

**Suggested fix:** Curate a small stable baseline set for the highest-value
surfaces (home, selected upload, populated dashboard/results/report, cards,
mobile, dark, and print) and compare with deterministic fonts/animations.
Keep broader captures manual if their churn is too high; publish diffs on
failure. This need not block on every antialiasing difference.

## Cross-browser, locale, and resilience gaps

- The release browser gate installs and runs Chromium only. Before a public
  compatibility claim, manually smoke Firefox and WebKit for file inputs,
  drag/drop, PDF workers, printing, local/session storage restrictions, and
  View Transition fallback.
- Korean locale formatting is covered functionally, but system timezone/locale
  variation is not in the browser matrix. Calendar logic uses strict ISO/UTC
  helpers and passed its unit suite; still run one non-Seoul host smoke for
  report dates and statement-month selection.
- Test retries are 2 only in CI, and traces begin on first retry. Five fixed
  two-second waits in `ui-ux-review.spec.js` should be replaced with
  state-based waits so a retry does not hide timing debt.
- Private browsing/storage denial is handled defensively in source but lacks a
  real-browser acceptance scenario; add one browser context with storage
  methods denied and confirm analysis remains usable with a clear persistence
  warning.

## Release-gate assessment

The checked-in workflow is structurally sound: pinned actions, frozen
dependencies, pinned Bun, scoped permissions, full repository verification,
browser regressions before upload, and failure artifacts. On this host, all
individually runnable gates and all 84 E2E tests passed. The chained `verify`
gate correctly refused Bun 1.3.12 because the repository requires 1.2.6, so a
release sign-off still requires the same commands under the pinned runtime.

The current green suites do not invalidate the Cycle 3 findings: each failing
scenario sits outside the asserted state transitions or sink boundaries.

## Final missed-issue sweep

I checked all upload states, route handoffs, persistence/reload paths, empty and
warning states, mobile sizes, keyboard paths, theme/print modes, catalog
loading failures, CLI visible outputs, and scraper completion messages against
the complete test inventory. No additional reproducible Critical/High QA defect
was found after the two state-transition defects and the visual-gate gap above.
