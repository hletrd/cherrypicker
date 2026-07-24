# Review-plan-fix Cycle 16 — designer / UI-UX

- Date: 2026-07-24
- Reviewed revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **0 genuinely new designer findings**
- Scope: review and this report only; no product source, test, fixture,
  configuration, generated data, plan, staging state, commit, push, deployment,
  or repository E2E run was changed

## Result

No reproducible current-HEAD UI/UX issue that is both open and genuinely new
relative to the completed and deferred history survived live browser
validation, source reconciliation, and the final missed-file sweep.

The completed Cycle 16 specialist reports retain **large worksheet metadata
bounds**. This is a normal input-validation/correctness matter needing
application-owned logical size limits before conversion/indexing. It is not a
separate designer finding.

## Inventory and novelty control

The exact baseline contains 2,354 tracked paths: 1,185 historical `.context`
records and 1,169 active product, test, fixture, configuration, documentation,
and generated-data paths. The current presentation surface contains:

- 80 files under `apps/web/src`;
- five Astro routes, one shared layout, 15 Svelte components, and one global
  stylesheet;
- three public runtime scripts, with the generated card catalog treated as a
  data boundary rather than hand-reviewed presentation source;
- 56 web test files; and
- 10 Playwright specifications.

I reviewed the complete presentation tree and the persistence, parser,
analysis, optimizer, catalog, formatting, and print boundaries that determine
rendered state. The current delta from the last fully reviewed UI baseline is
core-only; it does not introduce a new product presentation path.

Novelty control included all four authorized Cycle 15 recovery reports, every
completed Cycle 16 specialist report present at the closing cutoff, recent
designer reviews, archived implementation plans, the active high-priority
plan set, and the deferred-item ledger. The final static sweep covered
interactive elements, inline SVG semantics, fixed-width and horizontal-scroll
sites, landmark and heading ownership, live and error messaging, focus styles,
motion preferences, theme tokens, responsive breakpoints, and all five route
entry points.

## Browser-backed review

One isolated browser session,
`cherrypicker-c16-designer-20260724`, loaded the current production build from
Astro preview at `http://127.0.0.1:4174/cherrypicker/`. Evidence combined
accessibility snapshots, keyboard and pointer interaction, DOM and ARIA state,
computed styles, element geometry, storage inspection, network requests,
console/page-error inspection, and bounded Performance Timeline values. No
screenshot or repository artifact was created.

### Information architecture and cross-page consistency

- Home, dashboard, results, report, card catalog, and card detail retained one
  shared navigation, one `main`, and one footer. Each route exposed one
  level-one page heading and a coherent lower-level heading order.
- Dashboard, results, and report used the same warning and cap-disclosure
  vocabulary and ordering. The populated values and recommendation hierarchy
  remained consistent when moving between those routes.
- Empty and recovery states led back to the upload task; populated states
  exposed the next relevant dashboard, result, report, catalog, or print
  action without dead-end navigation.
- DOM checks found no duplicate IDs or unnamed buttons. Buttons, inputs,
  selects, pagination, disclosure groups, table scroll regions, and
  recommendation controls had specific accessible names.

### Home, upload, validation, and success

At 1440 × 1000, document width was `1440/1440`, `html.lang` was `ko`, and the
accessibility tree exposed the page heading, named upload region, polite
status, four-step list, labeled file input, theme action, navigation, and
footer.

First Tab exposed the skip link at approximately `132.7 × 36` at `(8, 8)`.
Enter moved focus to `main#main-content`. The same skip action on the catalog
preserved all 12 visible cards and used the fixed `#main-content` namespace.

Live form-state checks covered:

- an unsupported Markdown upload, which produced a localized alert and focused
  retry action;
- a valid tracked CSV, which exposed specifically named remove/add actions,
  grouped issuer choices, and a label-associated previous-spending input;
- `-1` and `20,000,000,000` Won validation, which set `aria-invalid`, linked
  both help and error text through `aria-describedby`, announced the localized
  error, and returned keyboard-submit focus to the input; and
- a valid `500,000` Won analysis, which exposed busy/disabled state while
  running, announced completion, and focused “대시보드 보기.”

The resulting analysis was stored only in session storage. The analysis value
was approximately 104,059 characters; only the theme preference used local
storage. A pointer-command focus sample that ended on `body` was rejected as
automation-command behavior: direct DOM event inspection and keyboard Enter
both confirmed the application focus path.

### Dashboard and disclosures

The populated dashboard exposed the page/status hierarchy, distinct cap
regions, analysis warnings, spending summary, category breakdown, savings
disclosure, transaction review, named recommendation sort group, and
recommendation output.

- Keyboard Enter opened and closed category and savings disclosures, updated
  `aria-expanded`, matched each `aria-controls` target, and retained focus.
- Transaction review retained focus when toggled and exposed a named,
  focusable horizontal-scroll region around its semantic table. Each category
  select was named by merchant.
- At 1440 px, the document did not overflow. Desktop alternative controls were
  approximately `25.2 × 36`, above the WCAG 2.2 AA 24 CSS-pixel target
  minimum.
- At 375 px, the document remained exactly viewport-width. The transaction
  table was 469 px wide inside its explicit `overflow:auto` owner, with a
  visible scroll hint and accessible region name. Recommendation rows switched
  to cards with 44 px actions.
- At 320 px, document width remained `320/320`, both navigation actions were
  `44 × 44`, each cap region fit its 288 px content box, and footer links
  wrapped without clipping.
- At 768 px, document width remained `768/768`; the 718 px transaction table
  and 670 px recommendation table stayed within their intended containers.

At 375 px, keyboard Enter opened the mobile menu with
`aria-expanded="true"` and the “메뉴 닫기” name. The `375 × 205` menu exposed
four `327 × 40` links and marked the current route. Escape restored the closed,
hidden/inert state and returned focus to the `44 × 44` trigger. No modal focus
trap was appropriate for this inline menu.

### Results, report, catalog, and detail

- Populated results at 375 px exposed only the data branch; loading, empty, and
  error branches were hidden. Its summary, named cap regions, mobile
  recommendation articles, and 44–46 px actions fit without document
  overflow.
- The animated savings value was sampled during its expected count-up and then
  matched the static `+20,000원` value after settling. This transient state was
  not inconsistent final content.
- Populated report at 375 px exposed a semantic summary table, named cap
  regions, warning content, recommendation/card articles, and a visible,
  enabled `154.95 × 40` print action without overflow.
- Removing only the analysis key produced the localized report empty state
  with print hidden and disabled. A deliberately malformed analysis value
  produced a localized alert and recovery action. The valid analysis was
  restored, and the temporary storage key was removed.
- The 375 px catalog loaded 683 cards at 12 per page. It exposed a labeled
  search field and sort control, named card-type group, issuer disclosure,
  separate named top/bottom pagination, a named result region, and fully named
  card actions. Pagination controls met the 44 px mobile target.
- Keyboard card activation opened
  `?card=shinhan-11st#main-content`, focused the detail heading, and retained a
  named breadcrumb, coherent heading order, a focusable benefit-table scroll
  region, and a source link using HTTPS with `_blank` plus
  `rel="noopener noreferrer"`.

All inspected runtime requests were same-origin and returned `200` or `304`.
Console and page-error inspection was empty on the accepted, validation,
empty, malformed-storage, catalog, and detail paths.

### Accessibility, themes, motion, and internationalization

Core text-token contrast samples were:

| Pair | Contrast |
| --- | ---: |
| light body / background | 17.06:1 |
| light muted / surface | 4.76:1 |
| light primary / surface | 6.70:1 |
| dark body / background | 16.30:1 |
| dark muted / surface | 5.71:1 |
| dark primary / surface | 8.11:1 |
| dark focus / surface | 5.75:1 |

The sampled text and focus pairs therefore met their applicable WCAG 2.2 AA
thresholds. Keyboard traversal showed visible focus, logical order, disclosure
state, and focus restoration. Mobile primary actions met the 44 px
AAA-oriented size used by the existing design; smaller desktop actions still
met the AA 24 px requirement.

Theme activation synchronized both visible controls, `aria-pressed`, the
action name, root class, and `cherrypicker:theme`. Light and dark body, surface,
border, semantic warning/cap, muted-text, and focus tokens remained legible;
dark body colors were `rgb(15, 23, 42)` and `rgb(241, 245, 249)`. Reload
retained the selected theme.

The installed browser command path did not expose reduced-motion media
emulation, so no false live claim is made. The production rule at
`apps/web/src/app.css:192-201` changes smooth scrolling to `auto`, limits
animation iteration to one, and reduces animation and transition duration to
`0.01ms`; savings and catalog scrolling also check the preference in
JavaScript.

The product is Korean-only, declares `lang="ko"`, and provides neither a
locale switch nor a supported RTL product mode. Current Korean copy, number
formatting, wrapping, labels, and instructions were coherent. Synthetic RTL
was not promoted into a defect for an unsupported mode.

### Bounded UX performance evidence

The fresh home navigation recorded approximately:

```text
TTFB 7.8 ms
DOMContentLoaded 37.7 ms
load 40.4 ms
FCP 92 ms
18 resources
```

Across upload and analysis interaction, the observer recorded cumulative
layout shift `0`, one 56 ms long task, and Event Timing samples around 16 ms.
These are local loopback diagnostics only. They provide bounded layout
stability and interaction evidence, but they are not field LCP, CLS, or INP;
no field Core Web Vitals conclusion is inferred, and the command path did not
yield a stable field-equivalent LCP sample.

## Historical reconciliation and rejected candidates

- `apps/web/src/pages/dashboard.astro:153` and
  `apps/web/src/components/cards/CardGrid.svelte:302` still expose decorative
  SVGs as unnamed image nodes. This is the previously owned Cycle 9
  `C9-D-01` / Plan 119 residual that the Cycle 12 aggregate explicitly
  rejected from new findings at
  `.context/reviews/2026-07-24-rpf-cycle12-aggregate.md:24-26`.
- Dashboard summary panels at
  `apps/web/src/pages/dashboard.astro:83-145` remain generic containers around
  visible headings. This is the existing deferred `D8-02` item at
  `.context/plans/00-deferred-items.md:1055`, not a new root.
- General automated axe coverage, older non-text contrast notes, and
  AAA-oriented 44 px desktop-target polish retain their historical owners.
- The pointer-command focus sample was contradicted by direct and keyboard
  evidence and was rejected as a tool artifact.
- The results savings count-up settled to the authoritative static value and
  retained its existing reduced-motion path.
- The Korean-only product has no supported RTL mode, so the absence of
  synthetic RTL behavior is not a current-product regression.

No other candidate survived current reproduction, exact-source tracing, and
full-history duplicate control. No new designer finding ID was assigned.

## Build and final missed-file verification

`bun run --cwd apps/web build` passed at the reviewed revision and generated
all five static routes.

`git diff --check HEAD` passed. The closing inventory reconciled all 2,354
tracked paths and all 80 web source paths. Product/source/test/fixture/
configuration/generated-data/plan files remain unmodified by this review.

The six protected Cycle 42 artifacts remained untracked, unstaged, and
byte-identical:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a  .context/plans/67-high-priority-cycle42.md
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1  .context/reviews/cycle42-aggregate.md
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266  .context/reviews/cycle42-code-reviewer.md
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0  .context/reviews/cycle42-debugger.md
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5  protected Cycle 42 review 5
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f  .context/reviews/cycle42-test-engineer.md
```

## Browser ownership and cleanup

Preflight immediately before launch proved:

- `bun scripts/run-e2e.ts status --assert-clean` reported no owned runs and
  default port 4173 available;
- `agent-browser session list` reported no active sessions;
- ports 4173 and 4174 had no listeners;
- the exact session, profile, review marker, and repository preview had no
  pre-existing process; and
- unrelated user Chrome root PID/PGID `1368/1368` was recorded for
  preservation.

The owned preview root was PID/PGID `48110/48110`, with Astro child PID
`48166` in the same process group, cwd `apps/web`, bound only to
`127.0.0.1:4174`. The owned browser daemon/root was PID `50688/50710` in PGID
`50688`, using exactly:

```text
session: cherrypicker-c16-designer-20260724
profile: /tmp/cherrypicker-c16-designer-profile.gwO82W
```

Cleanup closed only that named browser session and stopped only the recorded
preview terminal/process group. Final proof showed:

- no active browser sessions;
- no listeners on 4173 or 4174;
- PIDs `48110`, `48166`, `50688`, and `50710` absent;
- no process matching the exact session, profile, marker, or repository
  preview;
- repository E2E ownership clean with default port 4173 available; and
- unrelated Chrome PID/PGID `1368/1368` preserved.

After proving that no process referenced it, the exact temporary profile was
moved to the system Trash and is recoverable; the original path is absent.
No broader temporary directory and no unrelated browser data was touched.

Final count: **0 genuinely new designer findings**.
