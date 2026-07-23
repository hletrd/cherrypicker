# Cycle 7 designer report

- Review date: 2026-07-24
- Reviewed HEAD: `3086a379e31e5b17f82401807f5b3c24325b9962`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: information architecture, interaction and keyboard affordances,
  WCAG 2.2 behavior, responsive/theme/state presentation, and perceived
  performance
- Findings: 1 (`1 Medium`)

## Inventory and coverage

I inventoried all 76 files under `apps/web/src`, including 14 Svelte
components, 6 Astro page/layout files, the global design system, browser
workers, state/persistence code, and catalog/parser boundaries. I directly
reviewed all 5,021 lines of Svelte/Astro/CSS presentation code and traced the
relevant unit and Playwright coverage. The wider 2,175-path repository
inventory, all 683 card YAML files, and all 30 generated catalog artifacts were
already checked in the Cycle 7 cross-lens pass.

The source review covered:

- page hierarchy, headings, breadcrumbs, primary navigation, skip navigation,
  footer duplication, and card-list/detail IA;
- upload idle, selected-file, validating, loading, success, partial-warning,
  error, empty, and restored-result states;
- semantic labels, live regions, alerts, `aria-current`, `aria-pressed`,
  `aria-expanded`, `aria-busy`, disabled controls, focus restoration, Escape
  handling, and scrollable-region keyboard access;
- desktop/tablet/mobile breakpoint structure, horizontal overflow guards,
  target sizing, light/dark tokens, print mode, reduced-motion overrides,
  Korean language declaration, and direction-neutral layout risks;
- skeletons, deferred catalog/parser chunks, animation-triggered CLS risk,
  initial bundle boundaries, and interaction ownership.

The bounded live run used every required agent-browser capability:

- core navigation/session management;
- 1440×900 viewport configuration;
- keyboard and pointer interaction;
- semantic queries, accessibility snapshots, DOM/attribute/computed-style
  extraction, and element state;
- network request and local/session storage inspection;
- state save/inspection under `/tmp/rpf-cycle7-designer-state.json`;
- screenshots and accessibility-tree capture;
- console/page-error inspection, trace, and CPU profile;
- load-state and timed waits.

The live session exercised the home and card-list routes, keyboard skip
navigation, light/dark theme persistence, loading/network boundaries, and the
card-list error transition. Source, existing responsive E2E specifications,
and checked-in mobile visual baselines supplied the tablet/mobile and
reduced-motion complement after the bounded live run was stopped. No second
browser run was started.

Baseline live observations that did not become findings:

- Home accessibility snapshot exposed one Korean `h1`, named navigation,
  named upload region, ordered upload steps, a labeled file control, and no
  unnamed interactive element or duplicate ID.
- The 1440 px page had `scrollWidth === innerWidth`; no desktop horizontal
  overflow was present.
- The skip link itself became visible at `[8,8,132.67,36]` and focused
  `main#main-content`, so the defect below is the hash ownership collision,
  not a missing focus affordance.
- Theme toggle state and label stayed synchronized:
  `aria-pressed=false`, “어두운 테마로 전환,” and
  `localStorage["cherrypicker:theme"]="light"` after activation.
- Navigation timing was 63.6 ms to load completion with FCP at 104 ms on the
  local static preview; the run produced no uncaught page error or console
  diagnostic.

## Finding

### C7-D-001 — The card-list skip link is interpreted as a card selection and destroys the list view

- Severity: **Medium**
- Confidence: **High**
- Classification: **confirmed**
- Source regions:
  - `apps/web/src/layouts/Layout.astro:13,74-76,188`
  - `apps/web/src/lib/formatters.ts:258-260`
  - `apps/web/src/components/cards/CardPage.svelte:35-50,62-80,112-125`
  - Insufficient regression assertion:
    `e2e/web-regressions.spec.js:175-193`
- Live selectors:
  - `a[href="/cherrypicker/cards/#main-content"]`
  - `main#main-content`
  - `[role="alert"]`

The shared layout correctly builds the card-list skip link as
`/cherrypicker/cards/#main-content`. `CardPage`, however, owns the entire URL
hash as its detail-selection channel: on mount and every `hashchange`, any
nonempty hash becomes `selectedCardId`.

Text-extractable live sequence:

```text
1. Open /cherrypicker/cards/
2. Press Tab
   active accessible name: "본문으로 건너뛰기"
   computed box: [8, 8, 132.67, 36]
3. Press Enter
   URL: /cherrypicker/cards/#main-content
   focused element: main#main-content
4. CardPage handles the same hash
   breadcrumb current item: "main-content"
   main text: "목록으로 / 카드를 찾을 수 없어요 / 다시 시도"
   card grid count: 0
   alert text: "카드를 찾을 수 없어요 다시 시도"
```

The existing E2E test passes because it stops after asserting the URL suffix and
main focus. It does not assert that the card list remains rendered after the
reactive `hashchange`.

Why it matters: the principal WCAG 2.4.1 bypass mechanism causes exactly the
keyboard/screen-reader user who invokes it to lose the requested content and
hear a false error. The control initially appears to work because focus reaches
the landmark, then the Svelte effect replaces the list with an invalid card
detail. Recovery requires discovering and activating “목록으로” or “카드 목록.”

Concrete failure: a keyboard user opens Card List, tabs to the visible skip
link, and presses Enter to bypass global navigation. Instead of reaching the
card filters and results, the page announces that card `main-content` does not
exist.

Root fix:

- Give card selection a namespace that cannot collide with document landmarks,
  preferably a query parameter or route segment. If hash routing remains, use
  an explicit form such as `#card=<encoded-id>` and parse only that form.
- At minimum, reserve `#main-content` and validate a prospective hash against
  the published card-summary IDs before switching to detail view.
- Extend the skip-link E2E case to assert the `카드 목록` heading/card grid
  remains visible, no detail artifact is requested, and no alert appears after
  Enter. Add a direct hash-routing test for landmark, valid-card, and unknown
  hashes.

## Live evidence

Ephemeral artifacts were written only under `/tmp`:

- `/tmp/rpf-cycle7-home-a11y.txt`
- `/tmp/rpf-cycle7-cards-a11y.txt`
- `/tmp/rpf-cycle7-home-light-desktop.png`
- `/tmp/rpf-cycle7-cards-error-desktop.png`
- `/tmp/rpf-cycle7-designer-trace.json`
- `/tmp/rpf-cycle7-designer-profile.json`
- `/tmp/rpf-cycle7-designer-state.json`

The finding is supported by the accessibility snapshot, extracted DOM text and
HTML, URL, focus state, alert text, and source trace. The screenshot is
supplementary rather than the sole evidence.

## Process safety and cleanup proof

Before the run:

- `bun scripts/run-e2e.ts status --assert-clean` reported no owned run and port
  4173 available.
- The repo-owned process scan found no Playwright, preview, or attributable
  Chrome process.
- `lsof -nP -iTCP:4173 -sTCP:LISTEN` returned no listener.

Attributable run:

- Preview PID/PGID `99042`, command
  `node .../astro preview --host 127.0.0.1 --port 42773`, cwd
  `/Users/hletrd/flash-shared/cherrypicker/apps/web`.
- Agent-browser daemon PID/PGID `2330`; Chrome PID `2332`, PGID `2330`.
- Unique session/profile/argument marker:
  `rpf-cycle7-designer-3086a3`,
  `/tmp/rpf-cycle7-designer-profile-3086a3`, and
  `--cherrypicker-marker=rpf-cycle7-designer-3086a3`.

After the run:

- The exact agent-browser session was closed; its attributable PGID `2330` was
  terminated and reaped after the browser closed.
- The exact preview session/PID/PGID `99042` was interrupted and reaped.
- PIDs `99042`, `2330`, and `2332` were absent.
- No process retained the unique marker or port 42773.
- Both `lsof` checks for ports 42773 and 4173 returned no listener.
- A final `bun scripts/run-e2e.ts status --assert-clean` again reported the
  repository clean with default port 4173 available.
- Unrelated interactive Chrome/Remote Desktop/Travelback/xylolabs processes
  were neither signaled nor modified.

## Final missed-issue sweep

The final sweep revisited every Svelte/Astro/CSS presentation file, semantic
and focus-related selectors, mobile-menu ownership, light/dark/reduced-motion
tokens, upload and restored-analysis states, responsive overflow patterns,
catalog loading/error affordances, and current accessibility/E2E assertions.
Only the hash collision above met the threshold for a distinct current-HEAD,
text-evidenced finding. No source, plan, protected Cycle 42 artifact,
deployment, commit, branch, or external state was changed.
