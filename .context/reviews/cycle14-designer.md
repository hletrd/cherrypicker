# Review-plan-fix Cycle 14 — designer / UI-UX

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **0 genuinely new findings**
- Scope: review and this report only; no source, test, plan, configuration,
  generated-artifact, staging, commit, push, deployment, or repository E2E
  change/run

## Result

No reproducible current-HEAD UI/UX problem that is both open and genuinely new
relative to the archived reviews and plans survived browser validation and
duplicate control.

The principal user-facing Cycle 13 repair is the new authoritative
`portfolioCapLosses` presentation. It is exposed as a separate named region
from assignment-scoped cap-reach events, remains readable in both themes and
at 375 px, preserves ordered loss details, and is consistent across dashboard,
results, and report. The existing exact-cap “no loss” misstatement is fixed.

## Inventory and method

The current web UI has five Astro routes, one shared layout, 15 Svelte
components, one global stylesheet, three public runtime scripts, and **80**
files under `apps/web/src`. Its browser contract is covered by **56** web test
files and **10** Playwright specifications.

I reviewed the complete presentation tree and the persistence, worker,
analysis, catalog, and formatting boundaries that determine rendered state.
The audit covered:

- information architecture, hierarchy, copy, affordances, and feedback;
- native/ARIA semantics, keyboard order, focus movement/restoration, and
  target geometry;
- desktop and mobile layout, clipping, wrapping, horizontal scroll ownership,
  sticky-navigation stacking, and disclosure behavior;
- upload, validation, success, populated, empty, corrupted/error, loading-shell,
  filtering, and print-action states;
- light/dark theme tokens, reduced motion, Korean metadata, and RTL scope;
- console/page errors and bounded loopback navigation, paint, long-task, and
  interaction diagnostics; and
- full `.context` duplicate/fixed/deferred history, including the Cycle 13
  designer review and Plans 70, 136, and 138.

Before this report there were **1,183** `.context` files present: 1,169 tracked
records, the protected six Cycle 42 artifacts, and same-cycle reports written
by other roles.

## Browser-backed production evidence

One isolated `agent-browser` session,
`c14-designer-5260bbd`, loaded the existing post-HEAD production build through
Astro preview at `http://127.0.0.1:4173/cherrypicker/`. Evidence combined
semantic snapshots, direct interaction, DOM/ARIA state, computed styles,
bounding boxes, screenshots inspected at original resolution, console/error
queries, storage, and Performance Timeline values.

### Home, upload, validation, and success

At 1440 × 1000:

- `html.lang` was `ko`, computed direction was `ltr`, and document
  `scrollWidth/clientWidth` was `1440/1440`.
- The accessibility snapshot exposed navigation, one `main`, one contentinfo
  landmark, a level-one heading, the named upload region, polite status, four
  upload steps, and named file/theme controls.
- First Tab focused `#skip-link`. Its visible box was approximately
  `132.7 × 36` at `(8, 8)`, and Enter moved focus to
  `main#main-content[tabindex="-1"]`.
- Uploading the tracked `regression-upload.csv` exposed its filename and size,
  moved focus to its specifically named remove control, and revealed the
  grouped bank and previous-spending controls.
- Submitting `20,000,000,000` Won produced the localized
  “100억원 이하” alert, set `aria-invalid="true"`, referenced both error and
  help text through `aria-describedby`, and returned focus to the input in the
  same browser task.
- A valid `500,000` Won analysis completed, announced success, persisted the
  analysis, and focused “대시보드 보기.”

### Dashboard and changed cap contract

The populated dashboard was inspected at 1440 × 1000 and 375 × 812.

At desktop width, the accessibility tree exposed the page/status hierarchy,
summary, prior-spending basis, unsupported-benefit region, category
disclosures, comparison disclosure, transaction review, sort controls,
recommendation table, and result action. Category activation changed
`aria-expanded` from false to true, revealed its exact `aria-controls` target,
and retained a visible focus ring.

The changed cap UI produced two distinct regions:

- `data-testid="portfolio-cap-losses"` / “한도로 줄어든 최종 혜택” describes
  net portfolio loss after fallback reconciliation.
- `data-testid="cap-reach-events"` / “혜택 한도 도달 내역” explicitly says
  its transaction-level applied result is separate from final analysis loss.

Each region owns an `h2`, explanatory paragraph, and real list. At 1440 px
each measured `1232 × 134`. At 375 px each measured `343 × 234`, with
`scrollWidth/clientWidth` `341/341`; long card/category/cause copy wrapped
without clipping or document overflow. Light mode used rose/amber semantic
surfaces; dark mode switched them to dark semantic foreground/background/
border pairs while preserving legibility. Dashboard document width remained
exactly 375 px on the narrow pass.

Desktop recommendation disclosures met the WCAG 2.2 AA 24-CSS-pixel target
minimum. Mobile recommendations switched from the table to card-shaped rows
with visible 44 px “대안 보기” actions. The transaction and comparison
disclosures, sort group, warning dismissal, cap lists, and footer remained
inside the viewport.

### Mobile navigation

At 375 px, `matchMedia('(min-width: 768px)').matches` was false. The native
`#mobile-menu-btn` existed once and had:

```text
display/visibility/opacity: flex / visible / 1
box: x=307, y=16, 44 × 44
tabIndex/disabled: 0 / false
aria-label: 메뉴 열기
aria-expanded: false
aria-controls: mobile-menu
aria-hidden/inert ancestor: none
```

Keyboard Enter opened a `375 × 205` inline menu. Its four links measured
`327 × 40`; the current dashboard link exposed `aria-current="page"`.
Escape closed the menu, restored `inert`, changed the action name back to
“메뉴 열기,” and returned focus to the trigger. There was no overlay, modal
contract, or z-order collision requiring a focus trap.

The installed agent-browser accessibility snapshot omitted only the visible
menu trigger while continuing to expose its sibling theme button and all four
links after expansion. This was rejected as product evidence: the native
button's semantic/focus/keyboard state, computed visibility, original-resolution
screenshot, source and built markup, and existing production E2E contract all
agree. The Cycle 13 designer run already recorded the same expanded-link and
Escape/focus behavior, so the snapshot anomaly is neither a new regression nor
a defensible new finding.

### Results, report, catalog, and state branches

- Populated results at 1440 px exposed the summary, both cap regions,
  comparison disclosure, recommendation table, report/print/restart/dashboard
  actions, and no document overflow.
- The comparison's animated value was sampled once before settling, then
  matched the static `+20,000원` summary after 900 ms. This is the documented
  count-up behavior, not inconsistent final data.
- Populated report exposed a semantic summary table, both cap regions, the
  unsupported-benefit region, recommendation/card tables, and an enabled
  print action.
- Removing only the browser-session analysis key produced the report empty
  state with its print action hidden and disabled. A deliberately malformed
  session value produced a localized alert and “명세서 다시 올리기” recovery
  action. The valid snapshot was restored afterward.
- The 375 px catalog exposed a labeled search field, labeled sort combobox,
  grouped card-type buttons, issuer disclosure, duplicate top/bottom named
  pagination, a named result region, and fully named card buttons without
  document overflow.

### Theme, motion, runtime, and performance

Theme activation changed the root to `class="dark"`, synchronized the visible
action to “밝은 테마로 전환” with `aria-pressed="true"`, and persisted
`cherrypicker:theme=dark`; reload retained both state and action name. Dark
dashboard body colors were `rgb(19, 27, 45)` and `rgb(237, 241, 246)`.

The installed agent-browser media command did not expose reduced-motion
emulation, so no false live claim is made. The global production rule remains
present at `apps/web/src/app.css:192-201`: it switches smooth scrolling to
`auto`, limits animation iteration to one, and reduces all animation and
transition durations to `0.01ms`. Savings/card scrolling also checks the
preference in JavaScript.

The final fresh catalog navigation recorded approximately:

```text
TTFB 5.0 ms
DOMContentLoaded 24.8 ms
load 26.7 ms
FCP 44 ms
15 resources
0 long-task entries
0 Event Timing entries above 40 ms
```

These are bounded loopback diagnostics, not field Core Web Vitals. Console and
page-error inspection was empty on accepted flows. No field LCP/CLS/INP
conclusion is inferred.

## Historical reconciliation and rejected candidates

- **Fixed Cycle 13 owner:** post-cap loss now uses authoritative
  `portfolioCapLosses`; unknown/known-zero telemetry stays silent and cap-hit
  events no longer make an analysis-wide no-loss claim. This is the completed
  Plan 138 contract, not a new finding.
- **Historical/tool anomaly:** the mobile trigger snapshot omission is
  contradicted by native semantics, keyboard behavior, geometry, source/build,
  and the existing E2E contract. Cycle 13 already exercised the same control.
- **Historical animation behavior:** a mid-count-up value on results settled
  to the correct static total. The transient animation and reduced-motion path
  have extensive prior ownership.
- **Already owned/deferred:** general axe-gate coverage, AAA-oriented 44 px
  target polish, dashboard region-heading polish, and older non-text contrast
  notes retain their historical owners.
- **Rejected absent new evidence:** the prefixed/leading-NUL XLSX inflation
  hypothesis was not revived. This UI audit produced no current fixture or
  failing product boundary that supports it.
- The Korean-only product declares `lang="ko"` and provides no locale switch or
  RTL product mode. Synthetic RTL would not establish a supported-product
  defect, so RTL absence was not promoted.

## Verification

Focused presentation contracts passed:

```text
bun test \
  apps/web/__tests__/cap-disclosures.test.ts \
  apps/web/__tests__/dashboard-responsive-state.test.ts \
  apps/web/__tests__/decorative-svg-semantics.test.ts \
  apps/web/__tests__/page-ui-contract.test.ts \
  apps/web/__tests__/ui-semantic-badges.test.ts

17 passed, 0 failed, 207 expectations across 5 files
```

No repository Playwright/E2E command was run.

## Process ownership and cleanup

Preflight proved the repository E2E owner clean, TCP 4173 free, and
`agent-browser session list` empty. The isolated paths were:

```text
profile:   /tmp/cherrypicker-c14-designer-profile.HF5Jqz
artifacts: /tmp/cherrypicker-c14-designer-artifacts.jxatLB
session:   c14-designer-5260bbd
```

The production preview was exact PID/PGID `87082/87082`, command
`astro preview --host 127.0.0.1 --port 4173`, cwd `apps/web`, with no
descendants. The browser daemon/root was `90733/90736` in PGID `90733`; every
profile descendant was recorded. An earlier timed-out text-wait shell reported
as PIDs `1914/2219` was already absent when checked, so it received no signal.

Cleanup:

- closed only session `c14-designer-5260bbd`;
- stopped only preview terminal session `81360` / PID `87082`;
- verified all recorded browser, renderer, preview, and timed-wait PIDs absent;
- removed the exact profile and artifact paths with the system Trash command
  after proving no process referenced them; and
- retained the unrelated user Chrome root PID/PGID `1368/1368` unchanged.

Final proof:

```text
agent-browser session list: No active sessions
session JSON: []
TCP 4173 listeners: none
profile/artifact paths: absent
bun scripts/run-e2e.ts status --assert-clean:
  repository clean; default port 4173 available
```

The protected Cycle 42 artifacts retained their original SHA-256 hashes. The
only path written by this role is `.context/reviews/cycle14-designer.md`.

**Final count: 0 new findings.**
