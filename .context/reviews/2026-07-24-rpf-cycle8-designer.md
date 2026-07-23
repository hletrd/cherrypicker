# Cycle 8 designer review

- Review date: 2026-07-24
- Reviewed HEAD: `3fd993d471a8676170031f20715f6a53c99e8a9f`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Review role: product/interface designer
- Lens: actual Astro/Svelte information architecture, affordances, keyboard and
  focus behavior, WCAG 2.2, responsive/theme/locale states, and perceived
  performance
- Findings: **0**

## Whole-interface inventory

The repository inventory covered all 2,199 tracked paths and all 76 files under
`apps/web/src`. I directly reviewed all 5,081 lines across the 14 Svelte
components, six Astro pages/layouts, and global CSS, plus the three public
layout/frame/print scripts. I followed each presentation boundary into
formatters, card/catalog loaders, parser workers, optimizer state, persistence,
URL/hash state, and generated public data.

The review also traced all ten Playwright specification files and their current
accessibility, responsive, loading/error, upload, report, request-boundary,
security, and visual assertions. The source sweep covered:

- global and local navigation, headings, breadcrumbs, skip navigation, card
  list/detail hierarchy, footer duplication, and URL ownership;
- upload idle/selected/invalid/loading/success/partial-warning/error flows,
  restored analysis, dashboard disclosure, transaction editing, empty catalog,
  and retry states;
- labels, landmarks, live regions, alerts, table structure, `aria-current`,
  `aria-pressed`, `aria-expanded`, `aria-busy`, focus restoration, Escape,
  scrollable regions, and disabled controls;
- 375 px mobile, breakpoint/tablet structure, 1,440 px desktop, horizontal
  overflow, target size/spacing, light and dark tokens, print, reduced motion,
  Korean language declaration, and synthetic RTL resilience;
- skeleton and worker boundaries, LCP/CLS/INP risk, animation ownership, and
  stale/asynchronous state.

## Bounded live review

I used every loaded agent-browser capability in one attributable run:

- core navigation and named-session control;
- interaction through Tab/Enter/Escape, pointer activation, file upload,
  numeric form input, theme controls, mobile navigation, and card selection;
- semantic/accessibility snapshots plus DOM, attribute, focus, geometry, and
  computed-style queries;
- explicit load/text waits;
- network request-log clearing and a scoped catalog abort route;
- screenshots at desktop/light and mobile/dark;
- trace/debug start, DOM performance observers, and a profiler attempt;
- session-state save/inspection;
- viewport and color-media configuration.

Live scenarios and text-extractable evidence:

- At 1,440×1,000, the home page exposed one Korean `h1`, named navigation, a
  named upload region, an ordered four-step list, a labeled file control, no
  duplicate IDs, no unnamed buttons, and `scrollWidth === innerWidth`.
- Keyboard Tab revealed the skip link at `[8,8,132.67,36]`; Enter changed the
  URL to `#main-content` and focused `MAIN#main-content` without replacing the
  page. The Cycle 7 landmark/card-hash collision is fixed by the current
  `#card=` namespace and was not repeated.
- In light mode, measured contrast was 17.06:1 for body text/background,
  4.55:1 for muted text/background, and 6.70:1 for white on the primary action.
  Toggle labels and `aria-pressed` changed with the rendered theme. Dark mode
  was then exercised on the dashboard and mobile catalog.
- Submitting `-1` for previous-month spending kept focus on the number input,
  set `aria-invalid="true"`, referenced both error and help text through
  `aria-describedby`, and exposed the alert
  “전월 카드 이용액은 0원 이상이어야 해요.” Correcting it to `300000`
  completed analysis and produced the explicit “대시보드 보기” continuation.
- The dashboard accessibility tree contained the `h1`, completion status,
  summary and warning regions, expandable category controls, a captioned
  comparison, transaction disclosure, named sort group, and a row/column
  structured recommendation table. Current publication identity rendered
  `BNK부산은행` consistently.
- At 375×812, the card catalog remained 375 CSS pixels wide with no horizontal
  overflow. Theme and menu controls were 44×44; pagination controls were at
  least 44 CSS pixels; the menu opened from the keyboard, exposed current-page
  navigation, and Escape collapsed it while restoring focus to “메뉴 열기.”
  A full-page DOM geometry pass found no fixed overlay collision.
- Applying `dir="rtl"` at 375 px kept `scrollWidth === innerWidth` and mirrored
  the filter controls without clipping; `lang="ko"` remained present. The
  product is Korean-only, so this was a resilience check rather than a claim of
  translated locale support.
- Home navigation timing on the local static preview was 29 ms to
  `DOMContentLoaded`, 30.5 ms to load, and 76 ms to FCP. The observer recorded
  LCP at 76 ms, CLS `0`, and a longest captured interaction duration of 16 ms.
  These loopback measurements are useful regression evidence, not production
  field performance.

Screenshots were supplemental only:

- `/tmp/cherrypicker-c8-designer-3fd993d.cPAFIo/home-desktop-light.png`
- `/tmp/cherrypicker-c8-designer-3fd993d.cPAFIo/cards-mobile-dark.png`

The state artifact remained under
`/tmp/cherrypicker-c8-designer-3fd993d.cPAFIo/review-state.json`.

## Live-run limits and source/test complement

The scoped catalog abort route did not yield a UI error because the catalog
artifact was already satisfied by the browser/module cache; the request log
correctly reported no captured request. The loading, empty, alert, and retry
branches were therefore reviewed from `CardGrid.svelte:404-450` and their
existing request-boundary/E2E coverage rather than claimed as a second live
observation.

The browser's media override continued to report the host's dark preference
after requesting light, so actual theme controls supplied the light/dark
product evidence. Reduced-motion and tablet behavior were completed through
the current CSS/component branches and existing responsive E2E assertions, not
misrepresented as live emulation.

A debug trace was started, but export failed during bounded shutdown with
`CDP error (IO.read): Read failed`; the trace file is not cited as evidence.
The profiler correctly refused to start while tracing was active. DOM/AX text,
computed styles, focus state, performance entries, and screenshots above are
the retained evidence. A mistaken wait for automatic dashboard navigation was
cancelled once the success state showed that continuation is intentionally
explicit; this was a harness assumption, not a product defect.

## Findings

No distinct current-HEAD issue met the reporting threshold.

In particular, the live and source sweeps found no reproducible loss of
content, keyboard trap, focus loss, unnamed control, duplicate ID, horizontal
overflow, contrast failure, broken theme state, form-error ambiguity, or
mobile-menu failure. Source-only risk that could not be connected to a current
user-visible failure was not promoted to a designer finding.

## Process isolation and cleanup proof

Before the run:

- `bun scripts/run-e2e.ts status --assert-clean` reported no owned run and
  default port 4173 available.
- Exact repository-owned Playwright/Astro/Chrome command, cwd, parent, profile,
  and listener scans found no conflicting process.
- `lsof -nP -iTCP:4173 -sTCP:LISTEN` and the chosen-port check returned no
  listener.

Attributable run:

- Preview PID/PGID `78381`, command
  `node .../astro preview --host 127.0.0.1 --port 42889`, cwd
  `/Users/hletrd/flash-shared/cherrypicker/apps/web`.
- Named browser session `c8-designer-3fd993d-cPAFIo`, daemon PID/PGID `80759`,
  Chrome root PID `80808`, and profile
  `/tmp/cherrypicker-c8-designer-3fd993d.cPAFIo/profile`.
- Only `127.0.0.1:42889` was used. No repository E2E runner or default-port
  server was started.

After the run:

- The exact named browser closed successfully; PID/PGID `80759`, Chrome root
  `80808`, its descendants, and the unique profile marker disappeared from the
  process table.
- The exact preview session received `Ctrl-C`; PID/PGID `78381` was reaped.
- Neither 42889 nor 4173 retained a listener.
- A final `bun scripts/run-e2e.ts status --assert-clean` reported
  “repository clean (no owned runs; default port 4173 is available).”
- Independent parent verification reached the same result. No unrelated
  process was signaled or changed.

## Final missed-issue sweep

The final sweep revisited every Svelte/Astro/CSS presentation path, the three
layout scripts, all five routes, semantic and focus selectors, state
transitions, catalog and parser boundaries, mobile and breakpoint structure,
light/dark/reduced-motion tokens, Korean/RTL behavior, and current E2E
assertions. Fixed Cycle 6 issuer-label work and Cycle 7 card-hash work were
verified and not repeated.

Result: **0 current designer findings**.
