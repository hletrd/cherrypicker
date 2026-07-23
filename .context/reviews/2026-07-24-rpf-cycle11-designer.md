# Cycle 11 designer / UI-UX review

Date: 2026-07-24
Reviewed commit: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
Branch: `codex/review-plan-fix-no-deploy-20260723`

## Result

No genuinely new, actionable UI/UX defect was found on the reviewed HEAD.

The production inspection did reproduce or expose surfaces related to already-recorded work, but those are not relisted as Cycle 11 findings:

- `C6UI-04` / `C6UI-05`: existing non-text contrast findings.
- `D7-M8`: existing absence of a general automated axe gate.
- `D8-02`: existing dashboard section-region / heading association finding.
- `C6UI-23`: existing AAA-oriented 44 px target recommendation. The controls measured in this run met the WCAG 2.2 AA 24-by-24 CSS-pixel minimum.
- Previously reviewed CSP `unsafe-inline` work and the fixed reduced-motion spinner behavior.
- The rejected prefixed-XLSX/ZIP inflation finding was not resurrected.

## Inventory and historical comparison

Before live testing, I inventoried the web UI surface under `apps/web`: the shared Astro layout, four functional page shells plus the home page, 15 Svelte UI components, global CSS/theme/print behavior, web UI helpers, 54 web unit/contract tests, and the Playwright accessibility/UI/regression suites.

I compared the current implementation with the relevant current and archived review/plan material, including Cycle 9 and Cycle 10 designer/aggregate reviews, archived Plan 70 accessibility work, Plans 83/88/94/95/119, Plan 123, and the older Cycle 11 Plans 20/21/30. This comparison is the basis for suppressing the known items above.

## Production inspection

The accepted run used `bun run --cwd apps/web build` followed by the production Astro preview on `127.0.0.1:4173`. Browser evidence came from the complete `agent-browser` skill family: interaction, DOM/accessibility queries, waits, network/storage inspection, screenshots, console/error inspection, tracing/profiling, saved state, viewport/media configuration, and the core session commands.

### Home and upload flow

Inspected at 1440 by 1000:

- Production accessibility tree and DOM structure: skip link, primary navigation, theme control, page heading, upload landmark, ordered steps, live status, form controls, and footer navigation.
- Keyboard skip-link behavior: the focused link was visible at `(8, 8)`, approximately `133 × 36`, and Enter moved focus to `main#main-content`.
- Initial system-dark rendering and the light-theme toggle. Toggling updated the root class, persisted `cherrypicker:theme=light`, changed the accessible label to “어두운 테마로 전환,” and exposed `aria-pressed="false"`. Computed light colors were `rgb(248, 250, 252)` for the body background and `rgb(15, 23, 42)` for body text.
- Unsupported-file error: an uploaded Markdown file produced a localized alert/live-status message and moved focus to “다시 시도.”
- Valid-file form: a repository CSV produced the file list and step 2, with focus on the remove-file control.
- Invalid previous-spending state: the input exposed `aria-invalid="true"` and referenced both its error and help text. Keyboard activation correctly returned focus to that input.
- Completion state: dispatching the same valid CSV as an in-memory browser `File` completed analysis, advanced the progress UI to step 4, persisted the analysis state, and focused the “대시보드 보기” action.

The operating-system-backed file handle supplied by the browser automation layer became unreadable after about a minute. The application handled that failure with its localized retry state. I used an in-memory `File` containing the same fixture bytes to inspect the successful product state; the file-handle limitation is not reported as an application defect.

### Dashboard

Inspected in the light theme at 1440 by 1000 and at a 375-by-812 mobile viewport:

- The production accessibility tree exposed the page/status heading hierarchy, summary values, prior-spending disclosure, unsupported-rule region, category breakdown disclosures, comparison disclosure, transaction review, sort controls, recommendation table semantics, and footer/navigation.
- Category disclosure activation changed `aria-expanded` from `false` to `true`, revealed its matching `aria-controls` target, and retained focus on the trigger.
- The transaction review disclosure worked with keyboard Enter, retained focus on its trigger, and rendered the controlled panel. Its four category selects each had a transaction-specific accessible name; the table contained four rows.
- At 1440 px there was no document-level horizontal overflow.
- At 375 px, `documentElement.scrollWidth` equaled `clientWidth` (`375`), the mobile navigation trigger was `44 × 44`, and each visible mobile “대안 보기” action was at least `71 × 44`.
- The narrow transaction table measured 470 px, but remained inside its intentional horizontal-scroll presentation; it did not expand the document. The UI also provides the visible “표를 좌우로 스크롤할 수 있어요” instruction.
- All five footer links remained within the 375 px viewport.

The reviewed disclosure patterns are inline expansions, not modal dialogs, so a modal focus trap is neither expected nor recommended.

### States and themes reviewed statically

Source and test inspection covered loading, empty, error, retry, form validation, pagination/filtering, responsive card/table representations, print behavior, and page-state restoration across the cards, results, and report shells. Those pages were not separately exercised in the bounded production run, so this report does not claim new live evidence for them.

The root document is correctly Korean-localized (`lang="ko"`). There is no current RTL locale/product mode, so forcing a synthetic RTL document would not establish a current product defect. Global CSS contains a `prefers-reduced-motion: reduce` block that suppresses animation and transition durations, including the spinner/pulse/bounce utilities; no new reduced-motion gap was found in the static and regression-test inspection.

## Accessibility, visual, and performance evidence

- DOM/accessibility evidence, focus state, computed style, target geometry, and ARIA state were used in addition to screenshots.
- Production screenshots of the dark home page and light dashboard showed no clipping, overlap, obscured focus, or unexpected theme mismatch.
- Console and page-error inspection remained empty on the accepted production path.
- A reload recorded 18 same-origin resources with successful `200`/`304` responses. The local production navigation completed in about 52.4 ms and transferred about 7.8 KB of HTML.
- A layout-shift observer remained at `0` across the upload-to-dashboard flow. Observed interaction entries were approximately 16–32 ms, with no slow interaction discovered in this local run.
- The dynamic upload/error/success sequence changed the eventual LCP candidate long after navigation, so that value is not presented as a cold-load LCP measurement. The trace/profile are diagnostic evidence, not a lab or field Core Web Vitals result.

## Process ownership and cleanup

Baseline:

- `bun scripts/run-e2e.ts status --assert-clean` passed and TCP 4173 was free.
- The unrelated Travelback browser tree (initially rooted at PIDs 87713/88133, with profile under `/tmp/travelback-cycle12-dev-e2e.HqTO7i`) was recorded before launch and never signaled or otherwise modified. It exited independently during this review.

Attempt 1 was rejected as UI evidence because Astro's development toolbar appeared in the accessibility tree:

- Session: `cherrypicker-c11-designer-5a8e636c`
- Profile: `/tmp/cherrypicker-c11-designer-5a8e636c.YIbis6`
- Owned dev preview: PID/PGID 43188/43188 on TCP 4173 (the initial launcher PID 42759 had already exited)
- Cleanup: exact session closed, exact server terminated, exact profile deleted after no process referenced it, TCP 4173 verified free, and `status --assert-clean` passed before the one allowed retry.

Accepted production attempt:

- Session: `cherrypicker-c11-designer-prod-5a8e636c`
- Profile: `/tmp/cherrypicker-c11-designer-prod-5a8e636c.pJpnWa`
- Browser daemon/root: PID/PGID 73095/73095; Chrome PID 73097
- Owned preview: root PID/PGID 67651/67651; listener child PID 67745 on `127.0.0.1:4173`
- Cleanup: profiler stopped, exact browser session closed, exact preview PGID 67651 terminated, all four attributed PIDs verified absent, exact profile deleted after it was unused, and `agent-browser session list` reported no active sessions.

Final verification:

- `bun scripts/run-e2e.ts status --assert-clean` passed.
- TCP 4173 had no listener.
- Exact Cycle 11 browser/profile/preview process-pattern checks were clean.
- HEAD and branch remained unchanged.
- The six protected Cycle 42 artifacts remained untracked and unstaged with byte-identical SHA-256 hashes:
  - `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a`
  - `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1`
  - `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266`
  - `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0`
  - `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5`
  - `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f`

No source, test, generated, staged, committed, pushed, or deployed change was made by this review.
