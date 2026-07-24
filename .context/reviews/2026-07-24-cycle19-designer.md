# Cycle 19 designer / UX / browser review

## Result

No current UI/UX/browser issue that was both reproducible and genuinely new
survived live inspection and history reconciliation. Final novel designer
finding count: **0**.

The retained Cycle 19 lower-bound validator issue has no ordinary upload-path
UX impact because supported statement parsers restrict dates to 1900–2100.
Its persistence recovery should nevertheless remain fail-closed under the
code-review plan.

## Inventory and ownership

- Review revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`.
- UI inventory: 6 Astro pages/layouts, 15 Svelte components, shared CSS,
  three static layout/security/print scripts, 57 web unit-test paths, and 16
  E2E paths.
- Existing `apps/web/dist` was served by Astro preview at
  `http://127.0.0.1:4189/cherrypicker/`; no rebuild or install was needed.
- Preflight `bun scripts/run-e2e.ts status --assert-clean` reported no owned
  E2E runs and port 4173 available.
- Preview owner: Bun PID/PGID `6838/6838`, Astro listener child PID `6973`,
  exact listener `127.0.0.1:4189`.
- Browser session: `cherrypicker-c19-designer-20260724`.
- Profile:
  `/tmp/cherrypicker-c19-designer-profile.qhvSJ9`.
- Browser owner: agent-browser daemon PID/PGID `12151/12151`, Chrome root
  PID `12158`, with profile-attributed children in the same owned tree.
- Unrelated interactive Google Chrome PID/PGID `1368/1368` was present and
  was excluded from every cleanup action.
- An unrelated Playwright command rooted in
  `/Users/hletrd/flash-shared/xylolabs-panel-demo` was identified and
  preserved.

The complete agent-browser core, config, debug, interact, network, query,
state, visual, and wait skill instructions were read before browser actions.

## Live evidence

### Desktop, semantics, focus, and theme

At 1440×1000 the document had no horizontal overflow. The accessibility tree
exposed a skip link, navigation, one `main`, one level-one heading, a named
upload region, a polite status, a four-step list, a labeled file input, and a
content-info landmark.

Computed geometry recorded a 1,440 px body, 1,280 px main, 622×216 upload
region, sticky navigation at z-index 50, and visible theme control. First Tab
made the skip link visible at approximately 133×36 px with a browser focus
outline; Enter moved focus to `#main-content`. Subsequent keyboard order
followed the brand, primary navigation, and theme control.

Theme activation coherently changed the control name from “밝은 테마로 전환”
to “어두운 테마로 전환”. The sampled dark colors were
`rgb(15, 23, 42)` / `rgb(241, 245, 249)`. The immediately sampled light
colors, `rgb(230, 232, 235)` / `rgb(33, 41, 58)`, were intermediate values
inside `Layout.astro:73`'s 200 ms transition; the settled light tokens are
`#f8fafc` / `#0f172a` at `apps/web/src/app.css:20-22`.

### Mobile, RTL, loading, empty, error, and analysis states

At 375×812:

- document overflow was 0 px;
- desktop links were layout-hidden until the named “메뉴 열기” control was
  activated;
- the open menu exposed all four primary links and changed its name to
  “메뉴 닫기”;
- Escape closed it and restored focus to “메뉴 열기”;
- the card grid exposed labeled search/sort/type controls, two named
  pagination landmarks, and 12 accessible card buttons;
- aborting only `cards-summary.json` produced a visible `role="alert"` and
  named “다시 시도” action; removing the route and activating retry restored
  12 cards;
- dashboard, results, and report routes without usable state exposed polite
  empty statuses and links back to upload;
- programmatically selecting unsupported `README.md` produced both a specific
  polite status and visible alert naming the excluded file;
- a real `regression-upload.csv` analysis reached the completed state, then
  the populated dashboard exposed 4 transactions, 305,000원 latest-month
  spending, prior-month-basis disclosure, expandable charts/details, and
  recommendation navigation; and
- temporarily setting `html.dir="rtl"` produced no clipped visible element or
  horizontal overflow.

The populated mobile dashboard had zero recorded layout shift, zero buffered
long tasks, and only its expected local category-data request. The cards
navigation completed with DOMContentLoaded around 29 ms, load around 33 ms,
15 resources, approximately 65 KB local transfer, zero layout shift, and no
long task. These are local smoke signals, not field-performance claims.

Agent-browser 0.22.2 acknowledged reduced-motion emulation but did not change
the media query. Dynamic evidence was therefore discarded. Source and built
CSS contain the fail-safe rule at `apps/web/src/app.css:192-201`, and prior
E2E ownership covers the behavior.

Screenshots under `/tmp/cherrypicker-c19-*.png` are supplementary only; all
conclusions above use DOM, accessibility, computed-style, network, state, or
performance text.

## Final sweep and cleanup proof

The sweep covered IA, landmarks/headings, accessible names and expanded
states, keyboard/focus, WCAG 2.2 target/focus behavior, responsive
breakpoints, upload validation, loading/empty/error/retry states, light/dark
themes, reduced-motion source policy, RTL stress, request boundaries,
page errors, and perceived-performance signals. No new root remained after
comparison with current and archived review history.

Two agent-browser command shells stalled on a URL wait and console read:
PGIDs `21792` and `26860`. They were individually attributed to the exact
session/profile and terminated without a broad process match before cleanup.

Final cleanup:

1. `agent-browser close` reported “Browser closed”; daemon `12151`, Chrome
   root `12158`, and all profile-attributed children were absent.
2. The preview PTY received one Ctrl-C; PIDs `6838` and `6973` were absent
   and port 4189 had no listener.
3. `agent-browser session list` reported no active sessions.
4. The exact profile was moved recoverably to
   `/Users/hletrd/.Trash/cherrypicker-c19-designer-profile.qhvSJ9-20260724`;
   its original `/tmp` path was absent.
5. `bun scripts/run-e2e.ts status --assert-clean` again reported a clean
   repository and port 4173 available.
6. Interactive Chrome PID/PGID `1368/1368` remained running.

No second browser/preview attempt, full E2E gate, deployment, unrelated
process cleanup, or protected Cycle 42 artifact access occurred.
