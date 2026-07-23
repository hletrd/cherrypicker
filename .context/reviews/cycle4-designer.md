# Cycle 4 UI/UX designer review

## Outcome

Five findings are confirmed: **1 High, 3 Medium, 1 Low**. There are no Critical findings.

The strongest issue is a breakpoint collision on the dashboard: the layout becomes two columns at 768 px while both children switch to desktop-density layouts based on the viewport, not their much narrower containers. This clips key amounts and creates root horizontal scrolling. The remaining findings cover a contradictory keyboard disclosure, two failing dark-mode badge contrasts, excessive mobile catalog depth, and an enabled print action with no report data.

No deployment or source implementation was performed. The production build completed successfully before the live review. Only this review file was added.

## Findings

### D4-01 — Dashboard desktop-density children overflow their tablet containers

- **Severity:** High
- **Confidence:** High
- **Status:** Confirmed in the live production build
- **Files:** `apps/web/src/pages/dashboard.astro:55`, `apps/web/src/components/dashboard/SpendingSummary.svelte:76-95`, `apps/web/src/components/dashboard/CategoryBreakdown.svelte:223-255`
- **Selectors:** `#dashboard-data-content`, `#dashboard-data-content > .grid`, the two top-row `.card-transition` panels, `button[aria-controls^="category-details-"] > .grid`

At 767 px, the dashboard used its single-column/mobile presentation and had `scrollWidth === clientWidth === 767`. At 768 px, `md:grid-cols-2` activated and the document became **885 px wide in a 768 px viewport**, creating **117 px of root horizontal overflow**. At 900 px the document still overflowed by 51 px.

The measured 768 px geometry identifies both child failures:

- The category panel was 348 px wide (`clientWidth: 346`) but had `scrollWidth: 488`.
- Its inner category grid was 274 px wide but required 452 px.
- Amount cells reached `x=825` and percentage cells reached `x=885`, past both the panel's `right=744` and the viewport's `right=768`.
- The first spending-summary tile had `clientWidth: 89` and `scrollWidth: 116`; the primary `305,000원` value visibly ran out of its tile.
- At 1024 px root overflow happened to disappear, but the category panel still had `scrollWidth: 488` versus `clientWidth: 474`, with its final percentage outside the panel boundary.

This is not a z-index collision: the values are laid out beyond their cards. The cause is the parent switching to two columns at `md` while `SpendingSummary` uses `sm:grid-cols-3` and `CategoryBreakdown` uses a fixed five-track `sm:` grid (`1.25rem 6rem minmax(8rem,1fr) 7rem 3rem`). Those breakpoints react to viewport width even though each component has only about half the viewport.

**Failure scenario:** A tablet or narrow desktop user opens a completed analysis between roughly 768 and 1024 px. The most important spending total is clipped/overlapped, category amounts leave their card, and at the narrow end the entire page scrolls sideways.

**Root fix:** Make the top row two columns only when both cards can satisfy their contents (likely `lg`, subject to measured minimums), or use container queries so the summary and category components select their compact layouts from their own inline size. Keep the three-track category presentation and a two-column summary inside narrow containers. Add geometry coverage at 767, 768, 900, and 1024 px; `overflow: hidden` alone would only conceal information and is not a sufficient fix.

### D4-02 — Focusing a category disclosure opens it, then Enter closes it

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed with keyboard and pointer interaction
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:203-221`
- **Selector:** `button[aria-controls="category-details-0"]` (same behavior for every category row)

The live state sequence was:

1. Focus the collapsed category button: `aria-expanded="true"` and the details become `display: block`.
2. Press Enter, the normal “activate/open” action: `aria-expanded="false"` and the details become `display: none`.
3. Press Enter again: the details reopen.

A pointer click that first focused the row likewise ended collapsed. The component uses one `hoveredIndex` for hover preview, focus preview, persistent disclosure state, styling, and `aria-expanded`. `focusin` sets the index before the click handler runs, so the click sees the row as open and toggles it closed. `e2e/plan70-accessibility-regressions.spec.js:377-385` currently asserts this reversed sequence rather than guarding the expected disclosure behavior.

**Failure scenario:** A keyboard or screen-reader user focuses a category, hears that it is expanded, and presses Enter expecting to open/confirm it. The control announces and performs the opposite action. Touch activation is also vulnerable to the focus-before-click order.

**Root fix:** Separate transient hover/focus styling from persistent disclosure state. Bind `aria-expanded` and the details' visibility to an `expandedIndex` changed only by activation; use a separate hover/focus index only for visual emphasis. Update the test so first activation opens and second activation closes. A single local Event Timing sample for this double transition was 208 ms, so reprofile the interaction after removing the duplicate state/layout work.

### D4-03 — Credit and prepaid badges fail small-text contrast in dark mode

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed from live computed styles
- **Files:** `apps/web/src/components/cards/CardGrid.svelte:355-365`, `apps/web/src/components/cards/CardDetail.svelte:200-209`, `apps/web/src/components/dashboard/TransactionReview.svelte:317-326`
- **Selectors:** `[data-testid="card-grid-card"] > span` for catalog type badges; the type badge beside `[data-testid="card-detail-heading"]`; the transaction confidence badge at `TransactionReview.svelte:320`

At 12 px / weight 500 in dark mode, browser-computed colors produced these WCAG relative-luminance ratios:

| Badge | Computed foreground | Computed background | Ratio | Result |
|---|---|---|---:|---|
| Credit | `oklch(0.707 0.165 254.624)` (`blue-400`) | `oklch(0.379 0.146 265.522)` (`blue-900`) | **3.94:1** | Fail |
| Prepaid | `oklch(0.702 0.183 293.541)` (`violet-400`) | `oklch(0.38 0.189 293.745)` (`violet-900`) | **3.87:1** | Fail |
| Check, comparison | `emerald-400` | `emerald-900` | 5.01:1 | Pass |
| Reward-count, comparison | `green-400` | `green-900` | 5.11:1 | Pass |

Credit and prepaid are normal small text, so WCAG 2.2 SC 1.4.3 requires 4.5:1. The same blue pair is also used for the 10 px “높음” confidence badge in `TransactionReview`, making that instance at least as sensitive.

**Failure scenario:** In dark mode, a low-vision user scans the catalog or card detail and cannot reliably distinguish the small credit/prepaid labels from their dark badge fills.

**Root fix:** Use a lighter dark-mode foreground (for example, validate `blue-300`/`violet-300`) or adjust the badge background until every small-text pair is at least 4.5:1. Centralize semantic badge tokens and add computed light/dark contrast assertions so the catalog, detail, and transaction variants cannot drift.

### D4-04 — Mobile catalog pagination is buried below 36 cards and all issuer filters

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed at 320 × 568
- **Files:** `apps/web/src/lib/card-grid-state.ts:1,125-152`, `apps/web/src/components/cards/CardGrid.svelte:274-293,343-425`
- **Selectors:** `[aria-labelledby="issuer-filter-label"]`, `[data-testid="card-grid-page"]`, `nav[aria-label="카드 목록 페이지"]`

The mobile catalog has no horizontal overflow, but its interaction depth is excessive:

- A page always contains **36 cards** because `CARD_GRID_PAGE_SIZE` is viewport-independent.
- At 320 × 568, the page was **7,593 px** tall, or **13.37 viewport heights**.
- Pagination began at `y=7,106.97`.
- The 24 issuer pills ended at `y=761.59`, before the first page of cards.
- Each first-page card was approximately 288 × 155.6 px.

**Failure scenario:** A mobile user wants page 2 or to understand how many pages remain. They must move through every issuer chip and about twelve screens of cards before reaching the only pagination controls. Repeating this on every page makes catalog browsing disproportionately expensive.

**Root fix:** Put pagination/range controls above and below the grid, reduce the narrow-screen batch (for example 12), or use an accessible “더 보기” pattern that preserves URL/history state. Collapse the issuer list behind a labeled filter disclosure on narrow screens. If page size becomes responsive, define stable deep-link semantics rather than making the same `page=` query represent different item ranges unpredictably.

### D4-05 — Empty report still offers and executes “인쇄 / PDF 저장”

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed after clearing session state
- **File:** `apps/web/src/pages/report.astro:15-40,43-68`
- **Selector:** `[data-print-trigger]`

On a direct report visit with no analysis:

- `#report-empty-state` was visible.
- `#report-data-content` was hidden.
- `[data-print-trigger]` remained visible and enabled.
- With `window.print` safely stubbed, activating the control produced one print call and added `html.print-mode` while the empty prompt remained the only content.

The print toolbar is outside both visibility-managed containers, so `VisibilityToggle` never disables or hides it.

**Failure scenario:** A user opens the report from history or a fresh tab after session data has expired. The primary action promises a PDF but opens print UI for an empty-state prompt.

**Root fix:** Move only the print control into `#report-data-content`, or expose result availability to the toolbar and use a genuinely disabled button until data exists. Keep the report title and back navigation available. If disabled, provide a nearby explanation rather than relying only on `aria-disabled`.

## Coverage and pass evidence

### Information architecture and states

- Exercised Home, Dashboard, Card Catalog, Card Detail, Results, and Report.
- Covered upload selection, bank/previous-spending form, localized range validation and focus recovery, successful analysis/navigation, restored-state pages, direct empty pages, invalid card ID, catalog zero results, aborted catalog fetch, and retry recovery.
- The catalog loading skeleton has an off-screen `role="status"` and `aria-busy`; errors use `role="alert"` and retry recovered after the route abort was removed.
- Direct Dashboard, Results, and Report visits provide empty-state CTAs. The report print exception is finding D4-05.

### Keyboard, ARIA, target size, and z-order

- The first Tab exposes the skip link at `(8,8)`, with a visible outline and 132.7 × 36 px box; activation focuses `main#main-content`.
- Mobile menu controls measured 44 × 44 px. Opening updates `aria-expanded` and its accessible name, removes `inert`, and exposes 272 × 40 px links. Escape closes it, restores `inert`, and returns focus to `#mobile-menu-btn`.
- Card selection moved focus to the detail `h1[tabindex="-1"]`. The 640 px reward table is contained in a labeled, focusable horizontal scroll region (`scrollWidth: 640`, `clientWidth: 286`) without widening the 320 px document.
- `aria-pressed`, `aria-current`, labeled groups, table headers, alert/status regions, and disclosure relationships were present in the inspected states. No modal or focus trap exists.
- Shell layering is coherent: skip link `z-[100]`, sticky navigation `z-50`, hero content `z-10`, and the mobile menu is inline rather than an uncontained overlay. D4-01 is geometric overflow, not stacking.
- The desktop theme button is 36 × 36 px and the mobile controls are 44 × 44 px, meeting WCAG 2.2's 24 CSS px minimum target criterion.

### Responsive, themes, motion, i18n/RTL

- Live widths covered 320, 767, 768, 900, 1024, 1100, and 1440 px. The 320 px Dashboard, Cards, Card Detail, Results, and Report had zero root horizontal overflow; the 767/768 seam exposed D4-01.
- Light and dark semantic surfaces were inspected from computed styles. Core text/muted tokens remained legible; the two badge pairs in D4-03 did not.
- `apps/web/src/app.css:158-167` removes smooth scrolling and collapses animation/transition durations under `prefers-reduced-motion`; `CardPage.svelte` also avoids smooth scroll when that preference is active. The available browser CLI did not expose reduced-motion emulation, so this item is source-confirmed rather than a live media override.
- The product currently declares a fixed `lang="ko"` and has no locale/RTL selection contract. I did not score the absence of RTL as a defect for this Korean-only surface. If localization enters scope, physical `left`/`right` positioning, arrow glyphs, currency/date formatting, and hard-coded Korean labels need a dedicated logical-properties/i18n pass.

### Performance observations

These are local preview diagnostics, not field Core Web Vitals:

- Home navigation: TTFB 15.2 ms, DOMContentLoaded 26.8 ms, load 28.3 ms, FP/FCP 40 ms.
- Buffered LCP was 40 ms (2,852 px² element); clean reloads produced no layout-shift entries and no recorded long tasks.
- A clean restored Report reload also produced no buffered CLS entry. A shift observed during a full-page screenshot carried `hadRecentInput: true` and did not reproduce after a clean reload, so it was excluded.
- The category disclosure produced one 208 ms Event Timing interaction during its open-then-close double transition; it is supporting evidence for D4-02, not a standalone INP conclusion. Field INP still requires RUM or repeated representative profiling.

### Files and cross-file interactions inventoried

- Shell/pages/styles/scripts: `Layout.astro`, `app.css`, all five page files, `public/scripts/frame-guard.js`, `layout.js`, and `print.js`.
- UI components: upload, all dashboard components, all card components, report content, warnings, icons, issuer badge, and visibility toggle.
- UI state/data boundaries: `card-grid-state.ts`, `store.svelte.ts`, `store.ts`, `persistence.ts`, `pending-navigation.ts`, `formatters.ts`, `api.ts`, `cards.ts`, upload admission/validation, supported formats, analysis disclosures, and external URL handling.
- Config/docs/tests: root and web package manifests, `README.md`, `apps/web/astro.config.ts`, `playwright.config.ts`, and all UI/catalog/report/accessibility/visual E2E specs under `e2e/`.
- Cross-file checks included parent/child responsive breakpoints, server-rendered empty containers versus hydrated state, print mode ownership, theme token consumers, URL query/hash state, focus restoration, API abort/retry behavior, and existing breakpoint/accessibility regression coverage.

## Missed-issues sweep

A final sweep searched every UI component/page for disclosures, focus/hover coupling, physical overflow, dark badge pairs, print triggers, responsive grid switches, and viewport tests. It found the D4-02 state coupling and confirmed that existing geometry tests emphasize 320/375/400 mobile widths but do not protect the 768 px parent/child breakpoint collision. No additional actionable issue survived live reproduction and source tracing.

## Cleanup evidence

- The preview listener was exactly PID **89259**, command `astro preview --host 127.0.0.1 --port 4173`, cwd `/Users/hletrd/flash-shared/cherrypicker/apps/web`. It was stopped through its owning PTY session, not by a broad signal.
- The review-owned agent-browser tree was PID/PGID **3758**, with Chrome for Testing PID **3759**, helpers/renderers, and orphaned crashpads **3833/3839**, all using profile `agent-browser-chrome-05db66bf-962d-46f8-bf7b-1fb74183228f`.
- After `agent-browser close`, `agent-browser session list` returned **No active sessions**.
- A final `ps -p` for every known review-owned browser/helper/crashpad PID and preview PID 89259 returned no processes.
- A final process search found no command containing the cherrypicker repo path, that temporary Chrome profile, or Chrome for Testing 151, apart from the read-only verification command itself.
- A final `lsof -nP -iTCP:4173 -sTCP:LISTEN` returned no listener.
- Interactive Chrome PID **1368** and Codex PIDs **39959/39960** remained alive. No Travelback, xylolabs, interactive Chrome, or other-workspace process was signaled.
