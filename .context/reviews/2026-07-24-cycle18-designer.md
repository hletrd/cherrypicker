# Cycle 18 designer / UX / browser review

## Pre-interaction ownership notes

- Review revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Existing artifact only: `apps/web/dist/index.html`, 27,897 bytes, modified
  `2026-07-24T13:27:12+0900`; no rebuild or install was run.
- Required preflight:
  `bun scripts/run-e2e.ts status --assert-clean` reported no owned runs and
  default port 4173 available.
- Alternate preview endpoint: `http://127.0.0.1:4188/`; port 4188 was proven
  free before launch.
- Preview ownership before browser interaction:
  PID `6165`, PPID `39960`, PGID `6165`; command
  `node ../../node_modules/.bin/vite preview --host 127.0.0.1 --port 4188 --strictPort`.
- Isolated browser session:
  `cherrypicker-c18-designer-20260724`.
- Unique browser profile:
  `/tmp/cherrypicker-c18-designer-profile.9okbnq`, created by
  `mktemp -d /tmp/cherrypicker-c18-designer-profile.XXXXXX`, mode `0700`,
  inode `80379502`.
- Agent-browser ownership before navigation:
  daemon PID/PGID `9814/9814` (PPID 1), Chrome root PID `9815`
  (PPID/PGID `9814/9814`), profile-attributed children
  `9840, 9841, 9842, 9902, 9903, 9904, 10095, 10160, 10162, 10203, 10385`.
- Isolated CDP endpoint:
  `ws://127.0.0.1:57137/devtools/browser/718e3aa8-cff7-450f-8d4b-370ea40381b6`.
- Unrelated Google Chrome PID/PGID `1368/1368` was present before preview
  launch and remained present after isolated browser launch; its command was
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- Agent-browser 0.22.2 reported exactly one active session, the required
  session above. The initial viewport was set to 1440×900 before navigation.

These notes were written before page navigation or interaction. Findings,
scenario evidence, history reconciliation, and exact cleanup proof follow
after the single bounded browser attempt.

## Result and limitations

No current-HEAD UI/UX/browser issue that was both reproducible and genuinely
new survived live inspection and history reconciliation. Final novel designer
finding count: **0**.

The one retained Cycle 18 calendar root has a browser-facing consequence, but
not a separate design root: an invalid low-year predecessor can be disclosed
as though it were an ordinary month and then rejected by persistence after a
reload. That behavior should be included in the existing calendar-domain
repair.

There was one material test-environment limitation. The isolated command used
Vite's preview directly against `apps/web/dist`, while the artifact was built
with Astro's `/cherrypicker/` base. The HTML loaded, but Vite did not mount
the files at that base: initial island and public-script requests under
`/cherrypicker/` returned the fallback HTML or 404. The first accessibility
snapshot was consequently empty and the console recorded an Astro island
import error.

No second preview or browser attempt was started. Within the same page/session,
the review made a transparent in-memory correction: it removed only the
configured prefix from asset URLs, loaded the exact existing CSS/scripts/
modules from `apps/web/dist`, and restarted the existing Astro islands. The
request log then showed 200 responses for the exact built stylesheet and
modules. DOM, accessibility, interaction, theme, responsive, loading, empty,
and error evidence below comes from those exact built assets after that
runtime-only correction. Initial-load LCP/CLS values are not treated as
production measurements because the manual recovery contaminated the load
timeline.

## Live scenario evidence

### Desktop home, semantics, focus, and themes

At 1440×900:

- document and viewport width were both 1,440 px; there was no horizontal
  overflow, and document height was 1,827 px;
- the accessibility tree exposed a skip link, one navigation landmark, one
  `main`, one level-one “CherryPicker” heading, one content information
  landmark, a named upload region, a polite upload status, a named four-step
  list, and a labeled file input;
- the file input was multiple and advertised
  `.csv,.tsv,.xlsx,.xls,.pdf,.json,.ofx,.qfx,.html,.htm`;
- desktop navigation was visible and the mobile controls were layout-hidden;
  the upload region was 622×216 px;
- the first Tab made “본문으로 건너뛰기” visible at 132.7×36 px, fixed at
  8×8, with a computed focus outline; subsequent tabs moved in order through
  the brand, four primary links, and theme button, each with a visible
  outline; and
- keyboard activation changed the theme control's name, pressed state,
  persisted value, and colors coherently. The observed light body colors were
  `rgb(239, 241, 243)` / `rgb(24, 32, 50)`; the observed dark colors were
  `rgb(19, 27, 45)` / `rgb(237, 241, 246)`.

The initial and post-recovery semantic snapshots, computed geometry, storage,
and focus evidence agree. Screenshots at
`/tmp/cherrypicker-c18-desktop-light.png` and
`/tmp/cherrypicker-c18-desktop-light-confirmed.png` were supplementary only;
no conclusion depends on them.

### Mobile and RTL stress

At 390×844:

- document and viewport width were both 390 px with no horizontal overflow;
- desktop navigation was hidden;
- the theme and menu controls were each exactly 44×44 px;
- the upload region remained 308 px wide inside the viewport;
- opening the menu changed its accessible name from “메뉴 열기” to
  “메뉴 닫기”, changed `aria-expanded` from `false` to `true`, retained
  `aria-controls="mobile-menu"`, and exposed the four primary links; and
- the open menu occupied 390×205 px without obscuring its accessible
  structure.

For a controlled localization stress check, `html.dir` was temporarily set to
`rtl`. The document remained 390 px wide, the upload region remained within
41–349 px, all menu links used logical `text-align: start`, and the
accessibility structure remained intact. `dir` was restored to `ltr`
immediately afterward. This is a layout-resilience check, not a claim that the
current Korean-only product is localized for RTL. The mobile screenshot at
`/tmp/cherrypicker-c18-mobile-menu.png` was supporting evidence only.

### Reduced motion

The agent-browser 0.22.2 media command acknowledged both attempted
reduced-motion settings, but `matchMedia('(prefers-reduced-motion: reduce)')`
remained false. Dynamic emulation evidence is therefore inconclusive and is
not presented as an application failure.

The exact current source and built stylesheet were checked instead:
`apps/web/src/app.css:192-198` and the compiled layout CSS contain a
`prefers-reduced-motion: reduce` rule that reduces transitions and animations
to 0.01 ms and one iteration. Card-grid, card-detail, and savings animations
also query the same preference. Reduced-motion behavior has extensive prior
browser/test ownership, so no new finding was inferred from the automation
tool's failed emulation.

### Loading, empty, and error states

The card catalog's server-rendered/loading state exposed:

- one level-one “카드 목록” heading;
- labeled search and sort controls;
- a named card-type group; and
- a polite status, “카드 목록을 불러오는 중이에요.”

A controlled in-page catalog fetch rejection then produced a visible
`role="alert"` with “카드 목록 데이터를 읽지 못했어요. 잠시 후 다시
시도해 주세요.” and a specifically named “다시 시도” button. The page also
reported “0개 카드” without removing its filters or navigation.

With session storage cleared, the results route exposed a polite status and a
coherent empty state: “아직 분석 결과가 없어요”, “명세서를 올리면 최적 카드
조합을 알려줘요”, and named links back to upload. The visible accessibility
snapshot did not expose hidden result controls as active content.

These checks provide text, role, state, and DOM evidence for loading, error,
and empty possibilities; they do not rely on screenshots.

### Network, console, and page errors

The initial base-mount limitation produced only the expected Astro island
module errors under `/cherrypicker/_astro/`. After the in-memory prefix
correction, the request log recorded 200 responses for the current built
layout CSS, public scripts, FileDropzone/CardPage components, Svelte client,
store, formatter, icon, parser support, and catalog helper chunks. No
additional uncaught page error appeared after recovery.

The controlled catalog failure was injected at `window.fetch` and was rendered
as the accessible retry state described above. It is not counted as a network
defect.

### User-perceived performance signals

The raw local HTML navigation completed in 39.4 ms, with
`DOMContentLoaded` at 38.8 ms and no recorded long task. After recovery and
the keyboard/menu interactions, buffered event timing contained 21 entries,
seven interaction IDs, and a maximum observed duration of 24 ms. The
non-recent-input layout-shift sum was approximately 0.093.

Those values are useful only as smoke signals: the CSS/island recovery,
viewport changes, theme changes, menu opening, and RTL mutation occurred in
the same timeline. In particular, the recorded LCP was delayed until the
manually hidden shell became visible and is not a credible production LCP.
This report therefore makes no field-quality Core Web Vitals claim and
retains no LCP/CLS/INP finding.

## Calendar / YearMonth UX assessment

The retained low-year calendar defect crosses a visible boundary:

- `apps/web/src/lib/analysis-disclosures.ts:45-48,61-72` formats the supplied
  month by splitting it and converting only the month number. A malformed
  predecessor such as `999-12` is rendered as the plausible-looking
  “999년 12월” rather than identified as invalid.
- `apps/web/src/lib/persistence.ts:677-708,822-844` independently requires
  every previous-spending basis and monthly-breakdown month to pass
  `isYearMonth()`. The same malformed predecessor is rejected as corrupted
  during restoration.

Concrete user scenario: a supported-but-impractical low-year statement can
show a missing-previous-month disclosure during the fresh analysis, but its
saved result can fail restoration after reload and lead the user back to an
empty/re-upload experience. The live results-route check confirmed that the
empty recovery state itself is understandable and actionable.

Disposition: no new designer ID. This is downstream evidence for the existing
Cycle 18 calendar-domain finding. Its root fix should use one validated
`YearMonth` constructor across analysis, disclosure, and persistence and add
an analysis-to-restoration regression at the supported lower-year boundary.

## Historical reconciliation and missed-issue sweep

All 1,222 tracked current/archive `.context` paths were included in the
history corpus. Candidate-specific coverage found prior owners in 20 files
for `YearMonth`, 75 for reduced motion, 17 for RTL, 382 for focus/keyboard,
84 for loading/empty/error states, and 485 for performance/interaction terms.
The available non-protected Cycle 18 architect, debugger, document,
verifier, code, critic, performance, security, and dependency reports were
also reconciled.

The immediate Cycle 17 designer baseline already covered all five routes,
valid/invalid upload, populated/empty/malformed persistence, 1440/768/375/320
layouts, both themes, motion, keyboard disclosures, error states, and bounded
performance on unchanged presentation source. Its known decorative SVG,
generic dashboard container, automated axe, non-text contrast, desktop target
polish, and other UI observations retain their existing owners.

The closing sweep covered landmark/heading structure, accessible names and
states, keyboard order, skip-link visibility, focus indication, file-input
contract, theme persistence, responsive overflow, mobile targets/menu,
logical RTL layout, reduced-motion implementation, loading/empty/error
messages, retry/recovery actions, hidden-versus-visible accessibility
content, console/page errors, request status, and bounded performance
signals. No genuinely new designer root remained.

The six protected untracked Cycle 42 artifacts were excluded by exact path
and were never opened or modified.

## Final cleanup proof

Only the exact attributable resources were closed:

1. `agent-browser --session cherrypicker-c18-designer-20260724 close`
   reported “Browser closed.” Browser PGID `9814` exited after two 250 ms
   polls; no signal fallback was needed.
2. The retained preview PTY session `96101` received one Ctrl-C. Preview
   PID/PGID `6165/6165` was already absent when checked; no later signal was
   needed.
3. Before cleanup, all remaining browser processes belonged to PGID `9814`.
   After cleanup, root PIDs `9814`, `9815`, and `6165` and both owned PGIDs
   `9814` and `6165` were absent.
4. Port 4188 had no listener, and `agent-browser session list` reported no
   active sessions.
5. The exact profile was checked for inode `80379502` and for absence of a
   referencing process, then moved recoverably—without deleting or matching
   any broader path—to
   `/Users/hletrd/.Trash/cherrypicker-c18-designer-profile.9okbnq-20260724`.
   The Trash object retained inode `80379502`; the original `/tmp` path was
   absent.
6. `bun scripts/run-e2e.ts status --assert-clean` again reported no owned runs
   and default port 4173 available.
7. Unrelated Google Chrome PID/PPID/PGID `1368/1/1368` remained running with
   its original command.

No second browser/preview attempt, rebuild, install, deployment, product
change, broad gate, generic process match, or unrelated cleanup occurred.
The only repository write from this role is this report.

Final disposition: **0 genuinely novel designer findings**.
