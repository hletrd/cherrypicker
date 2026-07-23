# Cycle 3 — Designer / UI-UX Reviewer

**Review target:** `614ce5c`
**Mode:** live, read-only browser review plus DOM/accessibility/computed-style inspection.

## Live audit setup and coverage

I built and served the production app from the repository on isolated port `43217`, using only `AGENT_BROWSER_SESSION=c3-cherrypicker-designer`. Before launch, listener/PID working directories were attributed: no stale Cherrypicker preview/browser existed; the then-present agent-browser tree at PID 91551 belonged to `xylolabs-panel-demo` and was never signalled, and the previously recorded Travelback PID 63260 was not running. After capture, the exact browser session and preview were closed. Final checks showed port 43217 clear and `agent-browser session list` reported no active sessions.

The live pass covered:

- Home/upload at 1440×900 and 375×812, including keyboard/mobile navigation and drag/file controls.
- A rejected CSV error (`role=alert`), a valid Hyundai CSV through dashboard/results/report, processing completion, persistent-result and no-result states.
- Card catalog search, sort/filter state, zero-result reset, pagination, card detail, and keyboard activation.
- Dashboard, results, report, and card-detail layouts at mobile width; no horizontal overflow was found on those screens.
- Accessibility snapshots, landmark/heading/table names, `aria-pressed`/`aria-expanded`, focus visibility, live regions, touch target sizes, and computed styles.
- Light/dark themes, reduced-motion CSS, Korean language declaration, print/report structure, and RTL-readiness inspection.

Sampled computed foreground/background pairs in both themes met normal-text contrast, mobile theme/menu controls measured 44×44 px, cards retained a visible 3 px keyboard outline, dynamic card counts use `aria-live`, and reduced-motion rules collapse animations/transitions. The product currently declares only `lang="ko"`; omission of `dir` correctly defaults that locale to LTR. Directional icons/physical left-right utilities would need a deliberate mirroring pass before adding an RTL locale, but this is not a current advertised-language defect.

## Findings

### C3-DES-001 — Keyboard focus is discarded when the card grid swaps to detail view

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed in live browser
- **Location:** `apps/web/src/components/cards/CardGrid.svelte:330-365`; `apps/web/src/components/cards/CardPage.svelte:33-38,63-104`
- **Concrete failure scenario:** A keyboard or screen-reader user focuses a card and presses Enter. The grid is removed and a card-detail document fragment appears, but focus falls to `<body>`. The user receives no focus transition to the new `h1`, breadcrumb, or “목록으로” control and must restart navigation from the top of the page. Returning to the list likewise has no origin-focus restoration.
- **Evidence:** With the first `data-testid="card-grid-card"` focused, pressing Enter changed the URL to `cards#shinhan-11st` and the visible `h1` to “11번가 신한카드”; immediately afterward `document.activeElement` was `BODY`. The accessibility snapshot showed the entirely new detail hierarchy, while the document title remained “카드 목록 | CherryPicker”. `selectCard()` only mutates state/hash and scrolls; neither branch manages focus.
- **WCAG/UX impact:** WCAG 2.4.3 Focus Order and predictable SPA navigation; screen-reader context and keyboard efficiency.
- **Suggested fix:** On detail mount/hash navigation, update the document title and focus the detail `h1` (temporarily `tabindex="-1"`). Save the originating card ID/element and restore focus to it when returning to the grid, including browser back/forward. Add a keyboard E2E assertion for Enter → detail heading focus → Back → originating card focus.

### C3-DES-002 — The home hero creates horizontal page overflow at 375 px

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed in live browser
- **Location:** `apps/web/src/layouts/Layout.astro:186-188`; `apps/web/src/pages/index.astro:12-34`
- **Concrete failure scenario:** On a 375 px phone, the page can shift horizontally by 8 px, clipping the intended viewport alignment and making vertical scrolling feel unstable.
- **Evidence:** At a 375×812 viewport, `document.documentElement.scrollWidth` was **383** while `clientWidth` was **375**. The offender scan isolated the hero: bounding box `left=-8`, `right=383`, width `391`. The shared main uses `px-4` at mobile width, but the hero uses `-mx-6`; the negative margin exceeds its containing padding by 8 px on each side. Cards, dashboard, results, and report measured 375/375.
- **WCAG/UX impact:** Responsive layout and reflow quality related to WCAG 1.4.10.
- **Suggested fix:** Match the hero breakout to the container at each breakpoint (`-mx-4 px-4 sm:-mx-6 sm:px-6`) or use a full-bleed wrapper that cannot widen the root scroll box. Add 320/375/400 px assertions that `scrollWidth === clientWidth`.

### C3-DES-003 — The Korean card-detail landmark exposes an untranslated English accessible name

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/src/components/cards/CardPage.svelte:63-83`
- **Concrete failure scenario:** A Korean screen-reader user reaches the detail navigation landmark and hears the English word “breadcrumb” under the document’s Korean voice/language context, while all visible labels are Korean.
- **Evidence:** The live accessibility tree exposed `navigation "breadcrumb"`. Source hard-codes `aria-label="breadcrumb"` inside an otherwise Korean page and does not mark that label as an English language part.
- **WCAG/UX impact:** Language consistency and WCAG 3.1.2 Language of Parts.
- **Suggested fix:** Use a Korean accessible name such as `aria-label="이동 경로"` (or a localized message key if more locales are planned).

## Final missed-issue sweep

The last pass rechecked loading/empty/error affordances, form labels and validation announcements, toggle state semantics, mobile menu inert/escape behavior, pagination current state, table scroll instructions, theme persistence, print disclosure visibility, touch targets, contrast tokens, and console/page errors. The upload error was announced, empty analysis screens provided a clear upload CTA, filter/result counts were live, mobile menu state/focus restoration worked, and no uncaught browser errors were observed. No additional UI/UX issue met the reporting threshold.
