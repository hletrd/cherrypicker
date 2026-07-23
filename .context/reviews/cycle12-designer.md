# Cycle 12 designer / UI-UX review

Date: 2026-07-24
Reviewed commit: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
Branch: `codex/review-plan-fix-no-deploy-20260723`

## Result

Two genuinely new current-HEAD findings survived live reproduction and
full-history duplicate checks:

| ID | Severity | Confidence | Status | Summary |
|---|---|---|---|---|
| RPF12-D-001 | Medium | High | Confirmed | The newly displayed source hostname fails WCAG text contrast on issuer-tinted card headers in the light theme |
| RPF12-D-002 | Low | High | Confirmed | The card-search glyph remains an unnamed accessibility-tree image |

## Inventory and duplicate control

The reviewed UI contains five Astro routes, one shared layout, 14 Svelte
components, one global stylesheet, three public runtime scripts, 55 web unit
and source-contract tests, and ten E2E specifications. I inspected the page
shells, components and CSS, runtime state/persistence/navigation helpers,
accessibility and responsive contracts, relevant generated catalog
projections, the README and runner configuration, and the 13 UI paths changed
since the Cycle 11 designer baseline.

The initial `.context` inventory contained 1,135 review and plan files. I
indexed that complete history and ran candidate-specific searches across all
of it, then read the relevant designer, aggregate, accessibility, source-link,
and completed-plan provenance. In particular:

- RPF12-D-001 is downstream of completed Plan 128 and commit `52fc999`; no
  prior review discusses source-hostname color or contrast.
- RPF12-D-002 is not a relabeling of fixed C9-D-01. Completed Plan 119 covered
  the eight specifically listed upload and card-detail SVGs. No historical
  review or plan names `CardGrid.svelte:302`, the card-search glyph, or its
  accessibility-tree image. The already-fixed Plan 119 sites remain fixed.
- Existing C6UI-04/C6UI-05 non-text contrast, D7-M8 axe-gate, D8-02 dashboard
  region association, C6UI-23 AAA target-size polish, and previously resolved
  CardDetail tier-color findings are not counted again.

## RPF12-D-001 — Source hostname loses contrast on issuer tint

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Exact region:** `apps/web/src/components/cards/CardDetail.svelte:268-286`
- **Selector:** `[data-testid="card-source-link"] [data-testid="card-source-host"]`
- **Reproduction:** `/cherrypicker/cards/?card=shinhan-11st`, light theme
- **Relevant requirement:** WCAG 2.2 SC 1.4.3, 4.5:1 for 14 px normal text

Plan 128 correctly changed the external destination to the truthful accessible
name “상품 정보 출처 www.shinhancard.com.” The hostname is deliberately shown
so a user can judge the destination before opening a new tab, but it receives
the general muted token inside an issuer-colored gradient.

Live computed evidence at 1,440 by 1,000:

```text
source anchor box: x=137, y=345.594, width=255.844, height=20
source font: 14px / 20px
source label color: rgb(29, 78, 216)
hostname color: rgb(100, 116, 139) = #64748b
header background:
  linear-gradient(
    135deg,
    rgba(0, 70, 255, 0.133) 0%,
    rgba(0, 70, 255, 0.03) 60%,
    transparent 100%
  )
body surface: rgb(248, 250, 252)
```

The declared strongest tint composites to approximately `rgb(215, 226, 252)`,
where the hostname reaches only 3.67:1. Pixel samples immediately above and
below the hostname in the production screenshot were
`rgb(225, 232, 252)` and `rgb(227, 234, 252)`; using the computed hostname
foreground, their contrast ratios are 3.886:1 and 3.952:1. Both are below
4.5:1. The primary label remains above 5:1 on the strongest declared tint, so
only the newly separated hostname loses readability.

At 375 by 812 the same anchor remained within the viewport
(`x=49`, right edge `304.844`) but retained the same 20 px line and colors.
Dark mode changed the hostname to `rgb(148, 163, 184)` on the dark surface and
did not reproduce this light-theme failure.

This is more than decorative metadata: the hostname is the safety and
provenance cue added by Plan 128. A low-vision user can read “상품 정보 출처”
while losing the text that distinguishes an issuer page from a news,
aggregator, or wiki destination.

**Suggested repair:** give the hostname a tint-safe foreground rather than the
general surface-muted token. It may inherit `--color-primary-fg`, or use a
dedicated light-theme token such as a verified slate-700-equivalent while
keeping the current dark token. Add a browser contrast contract across
representative issuer tints, including Shinhan blue, instead of asserting only
the copy and hostname value.

## RPF12-D-002 — Card search exposes a nameless graphic

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Exact region:** `apps/web/src/components/cards/CardGrid.svelte:301-306`
- **Selector:** search decoration
  `.pointer-events-none.absolute.inset-y-0.left-3 > svg`
- **Reproduction:** `/cherrypicker/cards/`
- **Relevant requirement:** WCAG 2.2 SC 1.1.1

The 16 by 16 search SVG has no `aria-hidden` or accessible name. It is
decorative: the adjacent visible label and associated textbox both already
provide “카드 검색.” Nevertheless, the production accessibility snapshot
exposed this structure:

```text
LabelText "카드 검색"
generic
  image
  textbox "카드 검색"
```

The image is unnamed, so a screen-reader user encounters an unexplained graphic
immediately before an otherwise correctly labeled search field. This exact
site was outside Plan 119's completed upload/card-detail scope and has no
matching historical finding.

**Suggested repair:** add `aria-hidden="true"` and `focusable="false"` to this
SVG, or render it through the shared decorative `Icon` component. Extend the
decorative-SVG regression with the CardGrid search control and an
accessibility-tree assertion that no unnamed image precedes the search
textbox.

## Live coverage and non-findings

The accepted production build was inspected at 1,440 by 1,000 and 375 by 812
using the complete agent-browser skill family.

- **IA and affordances:** home/upload, card catalog and detail, dashboard,
  results, report, global navigation/footer, breadcrumbs, disclosures,
  pagination/filter controls, source link, and print actions were covered.
- **Keyboard/focus:** the skip link appeared at `(8, 8)` with a
  `132.672 × 36` box and moved focus to `main#main-content`; source-link
  keyboard focus received the browser's visible `auto 1px` outline; invalid
  previous-spending submission via Enter returned focus to
  `#previous-spending`; successful analysis moved focus to “대시보드 보기.”
- **Mobile navigation and z-order:** the trigger was `44 × 44`, the expanded
  menu was `375 × 205` inside sticky `nav` at `z-index: 50`, closed on Escape,
  became inert, and restored focus to the trigger. It is an inline disclosure,
  not a modal requiring a focus trap.
- **Responsive layout:** every sampled page kept
  `documentElement.scrollWidth === clientWidth` at 375 px. The 640 px
  card-benefit table remained inside its named 341 px horizontal-scroll
  region. Results actions measured 44–46 px high and the report print action
  measured 40 px high.
- **States and validation:** loading shells were present in source/DOM; empty,
  corrupted-storage error, successful data, upload validation, upload
  completion, and report/results control-readiness states were exercised.
  Corrupt persisted JSON produced the localized alert and removed the invalid
  storage value. Valid CSV analysis persisted 103,607 bytes and announced
  completion without a visible error.
- **Themes, motion, locale and RTL:** light and dark tokens, persisted theme
  state, global reduced-motion CSS, Korean `lang="ko"`, and the current lack
  of an RTL product locale were checked. A bounded synthetic RTL geometry
  probe did not create document overflow. Agent-browser 0.22.2 did not expose
  `prefers-reduced-motion: reduce` after its media command, so reduced-motion
  live emulation is not claimed; the source rule reduces all animation and
  transition durations and explicitly covers spinner/pulse/bounce utilities.
- **Network/runtime:** accepted-path requests were same-origin `200`/`304`.
  Console and page-error buffers were empty. Online/offline emulation toggled
  `navigator.onLine` as expected.
- **LCP/CLS/INP risk:** a loopback production dashboard reload recorded
  DOMContentLoaded at 47.7 ms, load at 48.1 ms, FCP and the buffered LCP
  candidate at 64 ms, zero buffered layout shift, and no long task. The event
  buffer did not expose a stable InteractionId in this headless run; a
  disclosure CPU profile captured 1,495 trace events without establishing a
  slow interaction. These are bounded local diagnostics, not field Core Web
  Vitals claims.

## Process ownership and cleanup

Baseline:

```text
E2E status: repository clean
default port 4173: available
agent-browser sessions: none
```

The production build completed successfully and generated five static routes.
The exact owned preview was PID/PGID `37650/37650`, started in PTY session
`92358`, listening only on `127.0.0.1:4173`. The cycle temp root was
`/tmp/cycle12-designer.K1du6v`.

An initial browser attempt used profile `profile.6LE162` and daemon/Chrome
PIDs `40053/40054` in PGID `40053`. A failed locator followed by a URL wait
left the CLI request unresponsive, so that attempt was rejected: the exact
session was closed, those PIDs and all profile users were confirmed absent,
and only that profile was deleted.

The accepted retry used:

```text
session: cycle12-designer
profile: /tmp/cycle12-designer.K1du6v/profile2.OvkKCW
agent-browser daemon / Chrome: 63134 / 63135
browser PGID: 63134
preview PID / PGID: 37650 / 37650
```

Cleanup ran before this report was written:

1. Stopped tracing/profiling and closed only `cycle12-designer`.
2. Verified PIDs `63134/63135` absent, no active session, and no process or
   file descriptor using the retry profile.
3. Sent the terminal interrupt only to preview PTY session `92358`; verified
   PID `37650` absent and TCP 4173 free.
4. Removed only `/tmp/cycle12-designer.K1du6v`.
5. Ran `bun scripts/run-e2e.ts status --assert-clean` successfully.
6. Verified no exact repo/profile/session process remained.

Final ownership evidence:

```text
E2E status: repository clean (no owned runs; default port 4173 is available)
No active sessions
TCP 4173: no listener
/tmp/cycle12-designer.K1du6v: absent
exact repo/profile/session process query: no attributable process
```

HEAD and branch remained unchanged. The six protected Cycle 42 artifacts
retained their baseline SHA-256 values:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f
```

No source, test, plan, generated, staged, committed, pushed, browser-server, or
deployment change was made. The only repository path written by this role is
`.context/reviews/cycle12-designer.md`.
