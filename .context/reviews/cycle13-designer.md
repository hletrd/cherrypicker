# Cycle 13 designer / UI-UX review

Date: 2026-07-24
Reviewed commit: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
Branch: `codex/review-plan-fix-no-deploy-20260723`

## Result

**No genuinely new current-HEAD designer/UI-UX finding survived validation and
full-history duplicate control.**

The two user-facing changes since the Cycle 12 designer baseline are the
source-host contrast repair and browser cap disclosures. The contrast repair
is present and covered across every issuer tint. The cap disclosure is
semantically structured, preserves every ordered event, distinguishes all
three cap periods, and is wired to dashboard, results, and report/print.

One plausible cap-disclosure concern was rejected as non-new: two otherwise
identical same-category cap events have no visible `ruleId`/`capGroup`
distinction. Cycle 12's original root-fix text already required preserving
“card plus rule/cap-group identity when several events share a category” and
tests for repeated/plural same-category events
(`.context/reviews/cycle12-critic.md:110-117`). Any remaining disagreement
about that presentation is an incomplete Cycle 12 repair, not a new Cycle 13
finding.

## Inventory and review method

The current web UI contains:

- five Astro routes and one shared layout;
- 15 Svelte components, one global stylesheet, and three public runtime
  scripts;
- 80 TypeScript/Svelte/Astro/CSS source files under `apps/web/src`;
- 56 web test files and ten E2E specifications; and
- the README, Astro/build configuration, persistence/store boundaries, card
  projections, and generated catalog readers that determine rendered states.

I inspected the complete presentation source and documentation, including
information architecture, controls and affordances, keyboard/focus behavior,
WCAG 2.2 naming/semantics/contrast, responsive branches, loading/empty/error
and validation states, themes, reduced motion, Korean localization, print,
and LCP/CLS/INP-sensitive code. The current web diff from the Cycle 12
designer snapshot consists of nine files, 296 insertions, and seven deletions.

The duplicate index covered all 1,160 Markdown files currently under
`.context`. Candidate-specific searches were reconciled with the Cycle 12
critic, designer, verifier, aggregate, completed Plans 133/136, and the
archived accessibility plans before assigning novelty.

## Current-HEAD delta evidence

### Cap disclosures

The shared projection preserves array order and one output object per input
event (`apps/web/src/lib/cap-disclosures.ts:23-42`). The rendered component:

- exposes a named `<section>` through
  `aria-labelledby="cap-disclosures-heading"`;
- uses an `h2` and a real list;
- identifies card, localized category, period, cap amount, applied reward,
  and lost reward; and
- has no interactive descendants or modal behavior requiring a focus trap
  (`apps/web/src/components/ui/CapDisclosures.svelte:14-40`).

The component is present in dashboard, results, and report/print at
`apps/web/src/pages/dashboard.astro:79-81`,
`apps/web/src/pages/results.astro:78-80`, and
`apps/web/src/components/report/ReportContent.svelte:104-111`.
Its amber text/background pairs calculate to 14.44:1 in light mode and
13.45:1 in dark mode. The list has no fixed width and can wrap at narrow
viewports.

The focused component contract uses four ordered events, including three
same-category events, and verifies all three period labels, localized
categories, applied/lost outcomes, and all three sinks
(`apps/web/__tests__/cap-disclosures.test.ts:9-118`).

The component intentionally displays each event rather than collapsing it.
It does not print `ruleId` or `capGroup`, so two identical events can produce
text-identical list items. This was **not promoted**: the exact identity and
same-category scenario belongs to the retained Cycle 12 `C12-CT-001` root
fix. Plan 136's acceptance records that repeated events must remain separate,
which the current `{#each}` does; reopening the stronger identity-copy
expectation must remain attached to that historical owner.

### Source-host contrast

`CardDetail` now applies the dedicated source-host token at
`apps/web/src/components/cards/CardDetail.svelte:268-286`. The tokens are
`#334155` in light mode, `#94a3b8` in dark mode, and `#334155` for print
(`apps/web/src/app.css:20-24,55-62,149-157`).

An independent calculation over all 24 issuer tints found these worst cases:

```text
light: #334155 on Hyundai-composited #dadcde = 7.531:1
dark:  #94a3b8 on Kakao-composited #2f3224 = 5.111:1
```

The current regression performs the same full matrix and requires at least
4.5:1 (`apps/web/__tests__/ui-semantic-badges.test.ts:113-159`). Cycle 12
`RPF12-D-001` is therefore fixed and was not repeated.

## Browser-backed evidence

The production build generated all five static routes successfully. One
isolated agent-browser session loaded and interacted with the built home UI at
`http://127.0.0.1:4173/cherrypicker/`.

The initial text-extractable accessibility snapshot exposed one navigation,
one `main`, one contentinfo landmark, a single level-one “CherryPicker”
heading, the named upload region, a status node, a four-item upload-step list,
and named theme/file controls. A DOM probe recorded:

```text
html lang: ko
document direction: ltr
main count: 1
h1 count: 1
duplicate IDs: none
document scrollWidth/clientWidth at 1280px: 1280/1280
DOMContentLoaded/load/FCP on loopback: 74/75/84 ms
```

The visually hidden native file input was exposed by the accessibility tree
as the “파일 선택” button through its wrapping label; a naive empty-text DOM
query was therefore correctly discarded as a false positive.

Keyboard and focus evidence:

```text
first Tab: #skip-link
focused skip-link box: x=8, y=8, 132.672 × 36 px
Enter destination: main#main-content[tabindex="-1"]
mobile menu open: aria-expanded="true", aria-controls="mobile-menu"
Escape destination: focus restored to button "메뉴 열기"
```

At 375 by 812, both `documentElement` and `body` remained 375 px wide with no
document overflow. The visible theme and menu buttons were each 44 by 44 px.
The accessibility snapshot exposed the four mobile navigation links only
while expanded. This is an inline disclosure rather than a modal, so a focus
trap is neither present nor required.

After selecting the visible theme button from a fresh semantic snapshot,
`html.className` became `dark`, the action name changed to “밝은 테마로
전환,” and `localStorage["cherrypicker:theme"]` became `dark`. The installed
agent-browser media command did not expose
`prefers-reduced-motion: reduce`, so live motion emulation is not claimed.
The source rule changes smooth scrolling to `auto`, reduces all animation and
transition durations to `0.01ms`, and limits iteration to one
(`apps/web/src/app.css:192-201`).

### Session limitation

The subsequent native file-upload command did not return. After it was
interrupted, a semantic snapshot and a read-only CDP attachment also timed
out; the exact owned renderer was consuming about 103% CPU at the process
sample. There was no extractable post-upload DOM, accessibility tree, console,
or stack evidence that could distinguish an application loop from an
automation/Chrome failure. It therefore does **not** meet the evidence bar for
a product finding. No second browser session was started.

Because that attempt became non-responsive, populated dashboard/results/report
states, offline/error transitions, cap rendering, and live LCP/CLS/INP were
not claimed from this session. Those paths were instead traced through their
rendered-source contracts and focused tests. The local home timings above are
bounded loopback diagnostics, not field Core Web Vitals. Source review found
no new LCP asset, fixed-size late media, unbounded transition, or synchronous
interaction loop in the current UI delta; the new disclosure is text-only and
uses normal document flow.

## Cross-surface coverage and non-findings

- **IA and affordances:** global navigation/footer, home/upload, dashboard,
  results, report, catalog/detail, filters, disclosures, and print ownership
  retain clear page headings and action labels. The cap section is placed
  before summary content in all result sinks.
- **Keyboard/focus and ARIA:** skip navigation, mobile disclosure state,
  upload/live-status wiring, retry/validation focus paths, card-detail focus
  restoration, tables, named scroll regions, and persisted-route visibility
  gates were reviewed. No new dialog or focus-trap surface was introduced.
- **WCAG and contrast:** current semantic color tests cover badges and all
  issuer/source-host combinations. The new disclosure foregrounds exceed AA
  in both themes. Decorative source-link and disclosure content introduce no
  new exposed image.
- **Responsive behavior:** the new cap list is naturally wrapping and has no
  fixed minimum width. Existing tables retain named horizontal-scroll
  containers or mobile alternatives. The live home/mobile navigation probe
  had no horizontal overflow.
- **Loading, empty, error, and forms:** server-first loading shells, distinct
  error/empty/data containers, localized upload validation, progress/live
  status, catalog retry, and report-print readiness remain explicit in source
  and the current page contracts.
- **Dark/light, motion, i18n/RTL:** theme state and action names synchronize;
  global reduced-motion coverage remains present. The product contract is
  Korean-only with `lang="ko"` and no supported RTL locale, so absence of an
  RTL translation was not treated as a defect.
- **Performance risk:** home FCP was 84 ms on the local production preview.
  Current UI additions contain no image, font, polling loop, or new input
  handler. No field LCP, CLS, or INP conclusion is inferred from a headless
  loopback run.

## Duplicate, fixed, and rejected-candidate ledger

- **Fixed:** Cycle 12 `RPF12-D-001` / `C12-005`, source-host contrast. The
  dedicated token and 24-issuer light/dark matrix now pass.
- **Historical duplicate:** the unnamed CardGrid magnifier remains the exact
  `C9-D-01` / Plan 119 root cause. Cycle 12 verifier lines 151-165 and
  aggregate lines 155-159 explicitly rejected a new ID for this residual.
- **Historical owner:** cap rule/cap-group differentiation and plural
  same-category events were expressly included in Cycle 12 `C12-CT-001`;
  they receive no Cycle 13 relabel.
- **Previously known, not repeated:** Cycle 6 non-text contrast/AAA target
  polish, Cycle 7 axe-gate coverage, and Cycle 8 dashboard region-heading
  association were not converted into new findings.
- **Inconclusive and rejected:** the stalled automation upload produced no
  text-extractable product evidence and receives no finding.

## Verification

```text
bun run --cwd apps/web build
  PASS — five static routes generated

bun test \
  apps/web/__tests__/cap-disclosures.test.ts \
  apps/web/__tests__/dashboard-responsive-state.test.ts \
  apps/web/__tests__/decorative-svg-semantics.test.ts \
  apps/web/__tests__/page-ui-contract.test.ts \
  apps/web/__tests__/ui-semantic-badges.test.ts
  PASS — 16 tests, 200 expectations, 0 failures
```

No repository E2E runner session was started.

## Process ownership and cleanup

Before the first browser action:

```text
runner: E2E status clean; TCP 4173 available
agent-browser sessions: none
session: c13-designer-3e2d663
profile: /tmp/cherrypicker-c13-designer.0LwxQG/profile
exact repo/profile/session processes: none
```

The exact preview was PID/PGID `56129/56129`, started in terminal session
`65788`, with cwd `apps/web`, listening only on `127.0.0.1:4173`. The browser
root was PID `59664` in PGID `59663`, using only the cycle profile above; its
local DevTools port was 49754. These values were captured through `ps`,
`lsof`, the profile's `DevToolsActivePort`, and `agent-browser session list`.

Cleanup closed only `c13-designer-3e2d663`, verified browser root `59664` and
its profile descendants absent, interrupted only preview terminal session
`65788`, and verified preview PID `56129` absent. Only the validated
cycle-specific profile/temp root was deleted.

Final ownership evidence:

```text
E2E status: repository clean (no owned runs; default port 4173 is available)
agent-browser sessions: none
TCP 4173 listener: none
/tmp/cherrypicker-c13-designer.0LwxQG: absent
exact repo/profile/session process query: no attributable process
HEAD: 3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9
branch: codex/review-plan-fix-no-deploy-20260723
```

The six protected Cycle 42 artifacts retained their baseline SHA-256 values:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f
```
