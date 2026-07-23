# Designer Review — CherryPicker Web Frontend (Cycle 1)

**Reviewer:** designer
**Date:** 2026-07-23
**Scope:** exhaustive UI/UX, responsive, accessibility, interaction-state, content, and perceived-performance review
**Constraint:** review only; no application-source changes and no deployment

## Executive summary

The visual system is generally cohesive and the main journey is understandable, but the current implementation has several high-impact trust and accessibility failures in the very flow where users upload financial data and act on recommendations. The highest-priority issues are:

1. Primary and issuer-brand foreground colors fail WCAG contrast in both themes.
2. Partial parse failures are stored but never surfaced, so recommendations can look complete when input rows were dropped.
3. The file drop target contains nested interactive controls and a single drag/drop is handled twice.
4. Interactive recommendation rows overwrite native table semantics.
5. Core mobile visualizations collapse to effectively invisible tracks.

This review records **25 findings: 6 High, 15 Medium, and 4 Low**. Of those, 22 are code-confirmed, 13 were also reproduced in a live Chromium session, and three require a final manual print/mobile verification after implementation.

## Method and coverage

I built the production bundle and exercised the live preview at desktop (1440×900) and mobile (375×812) widths. The interaction pass covered:

- initial home rendering in system-dark and user-selected light themes;
- desktop and mobile navigation, keyboard focus, Escape behavior, and accessibility-tree state;
- native file selection and synthetic drag/drop with an actual `File`;
- duplicate/error states and invalid previous-spending input;
- a complete fixture upload through analysis and client-side navigation;
- populated dashboard chart, comparison, sorting, disclosure, and table states;
- resource timing, network requests, browser errors/console, page dimensions, element geometry, and saved browser state;
- existing full-page UI screenshots as supporting, not sole, evidence;
- reduced-motion, print, empty, loading, error, and narrow-screen implementations by source inspection.

The production build completed successfully. It emitted a chunk-size warning; the home route downloaded an 856,146-byte decoded store/parser JavaScript resource (243,837 transferred) in the local preview.

### UI inventory examined

Every UI-relevant frontend file was inventoried:

- **Layout and routes:** `apps/web/src/layouts/Layout.astro`; `apps/web/src/pages/index.astro`, `dashboard.astro`, `results.astro`, `report.astro`, and `cards/index.astro`.
- **Global UI:** `apps/web/src/app.css`; `apps/web/public/scripts/layout.js`; `apps/web/public/icon.svg`.
- **Upload UI:** `apps/web/src/components/upload/FileDropzone.svelte`.
- **Dashboard UI:** `SpendingSummary.svelte`, `CategoryBreakdown.svelte`, `SavingsComparison.svelte`, `TransactionReview.svelte`, and `OptimalCardMap.svelte`.
- **Card UI:** `CardPage.svelte`, `CardGrid.svelte`, and `CardDetail.svelte`.
- **Report/UI utilities:** `ReportContent.svelte`, `Icon.svelte`, and `VisibilityToggle.svelte`.
- **Client-facing data/state:** `api.ts`, `build-stats.ts`, `category-labels.ts`, `category-labels-fallback.ts`, `cards.ts`, `formatters.ts`, `tx-validation.ts`, `store.ts`, `store.svelte.ts`, and `analyzer.ts`.
- **Parsing surfaces whose formats/errors reach the UI:** parser `index.ts`, `types.ts`, `detect.ts`, `amount.ts`, `column-matcher.ts`, `date-utils.ts`, `csv.ts`, `xlsx.ts`, `pdf.ts`, `json.ts`, `ofx.ts`, and `html.ts`.
- **Data assets:** `public/data/cards.json` and `categories.json`, including schema, metadata, representative tier/reward records, UI-consumed fields, and counts (683 cards, 24 issuers, 16 categories).
- **Configuration/tests:** root and web `package.json`, Astro/Playwright configuration, README UI instructions, and the current regression/UI screenshot specifications and fixture. Existing generated screenshots were visually inspected for the cards, dashboard, results, and report surfaces.

The product is intentionally Korean (`lang="ko"`), so RTL is not a current release requirement. Nearly all interface copy is hard-coded Korean; that is acceptable for the stated audience but should be extracted before adding another locale. No additional localization finding is filed solely for that future possibility.

---

## Findings

### D-01 — Primary and success foreground tokens fail contrast in dark mode

**Severity:** High
**Confidence:** High
**Status:** Confirmed (source, computed contrast, live dark theme)

**Evidence**

- `apps/web/src/app.css:5-17` defines `--color-primary: #2563eb` and `--color-success: #10b981`.
- `apps/web/src/app.css:38-45` changes dark surfaces to `#0f172a`/`#1e293b` but does not provide dark-theme foreground variants for either token.
- The primary token is used as text throughout the layout and content, for example `apps/web/src/layouts/Layout.astro:64-95`, `apps/web/src/pages/index.astro:33-45`, and `apps/web/src/components/report/ReportContent.svelte:44-55`.
- Computed contrast is approximately **2.83:1** for primary blue on the dark surface and **3.45:1** on the dark page background, below WCAG 2.2 AA's 4.5:1 requirement for normal text. Success green on white is approximately **2.54:1**; even the 24 px bold stat usage does not reach the 3:1 large-text threshold.

**User scenario and impact**

A user in dark mode cannot reliably distinguish active navigation, amounts, labels, and interactive links from their backgrounds. The same token is serving two incompatible purposes: a rich fill color that works behind white text and a foreground color that must contrast with surfaces.

**Recommended fix**

Split semantic foreground tokens from fill tokens, e.g. `--color-primary-fg` and `--color-primary-fill`, and define theme-specific values. Do the same for success/warning/danger. Add automated contrast assertions for every foreground/surface pair, including disabled and hover states.

---

### D-02 — Issuer brand colors are used as text without a contrast-safe treatment

**Severity:** High
**Confidence:** High
**Status:** Confirmed (source, computed contrast, both themes)

**Evidence**

- `apps/web/src/lib/formatters.ts:115-142` returns raw issuer brand colors.
- `apps/web/src/components/cards/CardGrid.svelte:193-229` and `apps/web/src/components/cards/CardDetail.svelte:123-179` place those raw colors directly on issuer labels and links.
- `apps/web/src/lib/formatters.ts:145-153` selects dark badge text for only KB, Kakao, and Jeju; all other badges receive white text.
- On white, representative raw-label ratios are KB **1.73:1**, Kakao **1.28:1**, Hana **3.72:1**, BC **3.58:1**, DGB/Kwangju **3.19:1**, and Jeju **2.86:1**. On the dark surface, Hyundai is **1.19:1**, Samsung **1.28:1**, KDB **1.03:1**, CU **1.23:1**, and Shinhan **2.31:1**. White badge text also fails on Lotte (~4.38:1), Hana, BC, DGB, and Kwangju.

**User scenario and impact**

Issuer identity and official-link affordances can disappear depending on issuer and theme. This is repeated across the card catalog, detail view, recommendations, comparisons, and report, multiplying the impact.

**Recommended fix**

Treat issuer color as a decorative accent/border, not an unrestricted foreground. Create a tested issuer presentation map with separate light/dark foreground and badge-background values. Preserve the brand hue in a non-text swatch or border when the original color cannot meet contrast.

---

### D-03 — Partial parse errors never reach the user

**Severity:** High
**Confidence:** High
**Status:** Confirmed (source/data-flow review)

**Evidence**

- Parsers deliberately produce recoverable warnings; for example, `apps/web/src/lib/parser/index.ts:64-73` warns about damaged encoding while continuing.
- `apps/web/src/lib/analyzer.ts:104-168` carries parser errors forward, `apps/web/src/lib/analyzer.ts:343-365` aggregates them, and `apps/web/src/lib/analyzer.ts:462-471` returns them in `AnalysisResult`.
- `apps/web/src/lib/store.svelte.ts:68-81` retains the field in the public result type.
- No page or component reads `analysisStore.result.parseErrors`; the only component-visible errors in `FileDropzone.svelte:315-355` are fatal `analysisStore.error` failures.
- Restored results explicitly discard the warnings with `parseErrors: []` at `apps/web/src/lib/store.svelte.ts:332-343`.

**User scenario and impact**

A statement with malformed rows or encoding damage can still produce polished recommendations. The user is never told that some transactions were omitted or merchant text may be corrupted, so they may make a financial choice from incomplete input.

**Recommended fix**

Show a persistent, dismissible “analysis completed with warnings” summary before recommendation content. Include affected file, line when available, the number of excluded rows, and a safe expandable detail view. Persist a bounded warning summary with the result instead of resetting it. Make incomplete analysis visibly different from complete success.

---

### D-04 — The upload surface contains nested controls and an incomplete keyboard model

**Severity:** High
**Confidence:** High
**Status:** Confirmed (source, live tab order, accessibility tree)

**Evidence**

- `apps/web/src/components/upload/FileDropzone.svelte:423-444` turns the entire drop region into `role="button"` with `tabindex="0"`.
- Once populated, that button contains repeated native remove buttons, a file-add label/input, and a clear button at `FileDropzone.svelte:458-496`.
- In the empty state, the visible “파일 선택” label/input is also nested at `FileDropzone.svelte:498-508`.
- The live accessibility tree exposed a button containing child buttons (“파일 제거”, “전체 삭제”). The visible “파일 선택/파일 추가” controls were not independent tab stops; only the outer synthetic button was keyboard reachable.
- Every remove control has the same name, “파일 제거,” at `FileDropzone.svelte:470-478`, so multiple files are indistinguishable to screen-reader users.

**User scenario and impact**

Keyboard and screen-reader users encounter invalid nested interaction semantics. Activating the parent can compete with child controls, and a list of identically named remove buttons gives no way to know which statement will be removed.

**Recommended fix**

Use a native labeled file input as the primary control and make the surrounding drop surface non-interactive presentation. Place file-list actions outside that label/button. Give each removal action an accessible name containing the filename, e.g. “5월-명세서.csv 제거.” Keep drag instructions in descriptive text associated with the input.

---

### D-05 — Recommendation rows overwrite native table semantics

**Severity:** High
**Confidence:** High
**Status:** Confirmed (source, live accessibility tree)

**Evidence**

- `apps/web/src/components/dashboard/OptimalCardMap.svelte:80-90` creates a native table with scoped column headers.
- Each `<tr>` is then assigned `role="button"`, `tabindex="0"`, and disclosure behavior at `OptimalCardMap.svelte:92-137`.
- In the live accessibility snapshot, the headers remained under a table, but each data row appeared as a sibling **button**, not a row associated with those headers.
- The button's explicit label at `OptimalCardMap.svelte:102` includes only category and card name, omitting the visible rate and monthly reward.

**User scenario and impact**

A screen-reader user hears a sequence of buttons with no reliable “혜택률” or “월 예상 혜택” header relationship, and the explicit label suppresses important visible decision data.

**Recommended fix**

Keep each `<tr>` a semantic row. Put a real disclosure `<button aria-expanded aria-controls>` in the final cell (or in the card-name cell), give the alternatives row a stable ID, and retain the row's native cells/header associations. The disclosure name should identify the category/card while the remaining values stay available through table navigation.

---

### D-06 — Core mobile charts collapse to invisible or meaningless tracks

**Severity:** High
**Confidence:** High
**Status:** Confirmed (live geometry at 375 px, source)

**Evidence**

- `apps/web/src/components/dashboard/CategoryBreakdown.svelte:221-249` reserves fixed widths for rank (`w-5`), label (`w-24`), amount (`w-28`), percentage (`w-12`), plus gaps and padding, leaving its flexible bar no width.
- At a 375 px viewport, every category row was 277 px wide and the actual bar container measured **0 px**.
- `apps/web/src/components/dashboard/SavingsComparison.svelte:155-184` similarly reserves `w-24` and `w-28` around each flexible track.
- The two savings tracks measured only **11 px** wide on the same viewport (fills measured 8 and 11 px), which cannot communicate a comparison.

**User scenario and impact**

On a common phone width, two central decision visualizations either disappear or reduce to tiny colored ticks. Text values remain, but visual rank/comparison—the point of the charts—is lost.

**Recommended fix**

Introduce a narrow-screen layout: put label/value in a top row and give the bar a full-width second row. Use CSS grid with responsive areas instead of fixed width utilities. Add a regression assertion that chart tracks retain a meaningful minimum width (for example ≥120 px at 375 px) and that the CategoryBreakdown bar is nonzero.

---

### D-07 — A drag/drop gesture is processed twice and immediately reports a false duplicate

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (live reproduction and source)

**Evidence**

- `apps/web/src/components/upload/FileDropzone.svelte:29-69` registers a document-level `drop` handler that calls `addFiles`.
- The child drop target independently calls `handleDrop` at `FileDropzone.svelte:423-443`; the event is not stopped or filtered.
- In the live app, dispatching one bubbling `drop` with `drop-duplicate.csv` added the file and immediately rendered: “같은 이름의 파일이 이미 있어요 (제외됨: drop-duplicate.csv).”

**User scenario and impact**

Every user who drops directly on the advertised target can see an error on a successful first upload. This damages confidence before the financial analysis even starts.

**Recommended fix**

Choose one authoritative drop handler. Prefer the document handler only for out-of-zone drops, with an `event.target` guard, or stop propagation in the zone handler. Add an end-to-end test asserting one drop produces one file and no duplicate alert.

---

### D-08 — Out-of-range previous spending stays submittable and is silently clamped

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (live native validity and source)

**Evidence**

- The numeric input declares `max="10000000000"` at `apps/web/src/components/upload/FileDropzone.svelte:561-576`.
- The analysis button at `FileDropzone.svelte:584-605` is not part of a form and does not inspect input validity; it is disabled only during analysis.
- `parsePreviousSpending` silently clamps larger values to the maximum at `FileDropzone.svelte:282-313`.
- Live input value `20,000,000,000` produced `valid=false`, `rangeOverflow=true`, and a browser validation message, while the “분석 시작” button remained enabled. The input had no `aria-invalid` or `aria-describedby`.

**User scenario and impact**

A typo can alter the performance-tier baseline without the user knowing. The browser knows the value is invalid, but the app bypasses the constraint and proceeds with a different number.

**Recommended fix**

Use a real form or explicitly call `reportValidity()` and block analysis. Render a localized inline range error linked with `aria-describedby`, set `aria-invalid`, and never silently transform a user-entered financial value. If a cap is a business rule, explain it before submission.

---

### D-09 — The 50 MB warning is written to state but cannot render

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (source)

**Evidence**

- `apps/web/src/components/upload/FileDropzone.svelte:212-217` stores a 50 MB warning in `errorMessages` but deliberately leaves `uploadStatus` non-error.
- The only renderer for `errorMessages` is conditional on `uploadStatus === 'error'` at `FileDropzone.svelte:610-632`.

**User scenario and impact**

A large multi-file upload may become slow, yet the warning promised in code is invisible. The user gets no chance to reduce the upload or understand the delay.

**Recommended fix**

Model warnings separately from fatal errors and render a visible `role="status"`/polite banner whenever warning messages exist. Do not overload the fatal-error state machine for nonblocking guidance.

---

### D-10 — Mobile recommendation table is technically scrollable but unreadably compressed

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (live geometry and screenshot)

**Evidence**

- The table uses `w-full` inside `overflow-x-auto` but has no minimum width at `apps/web/src/components/dashboard/OptimalCardMap.svelte:80-89`.
- At 375 px, the entire table was 277 px. Header widths were approximately 35 px (category), 75 px (card), 80 px (rate), 62 px (reward), and 24 px (arrow), with the header wrapping to 53 px high. Data cells inherited the squeeze and Korean labels wrapped almost character-by-character.

**User scenario and impact**

The most important recommendation content becomes slow to scan and visually noisy on a phone. The overflow wrapper provides no benefit because the table is allowed to shrink instead of overflowing.

**Recommended fix**

Prefer a responsive card/list representation below the tablet breakpoint. If retaining the table, give it an appropriate `min-width`, label the scroll region, and preserve a sticky category/card column. Validate long Korean card names, 200% zoom, and 320–375 px screens.

---

### D-11 — Card detail exposes internal performance-tier IDs instead of user labels

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (source and production data)

**Evidence**

- Card data separates tier IDs from labels, e.g. `performanceTiers: [{ id: "tier1", label: "전월 40만원 이상" }]`, while reward rows reference `performanceTier: "tier1"`.
- `apps/web/src/components/cards/CardDetail.svelte:59-79` groups rewards directly by the ID.
- It renders that ID both as a group heading and as “적용 실적” at `CardDetail.svelte:217-258`, including values such as `tier0` and `tier1`.

**User scenario and impact**

Users see implementation identifiers where they need understandable eligibility requirements, making the reward table look unfinished and requiring them to cross-reference a separate section manually.

**Recommended fix**

Build an ID-to-label map from `card.performanceTiers` and render the Korean label in both locations. Fall back to a human-readable “기본” only when an ID truly has no metadata, and log/validate orphan IDs in data tests.

---

### D-12 — The 683-card catalog eagerly fetches full detail data and renders every card

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (source, production asset, generated-page height)

**Evidence**

- `public/data/cards.json` is **3,421,389 bytes** raw (171,107 bytes gzip in a local size check) and contains full rules for 683 cards.
- `apps/web/src/lib/cards.ts:135-185` fetches and parses that entire asset, even for the list.
- `apps/web/src/lib/cards.ts:237-258` derives summaries only after the full payload is loaded.
- `apps/web/src/components/cards/CardGrid.svelte:193-231` renders all filtered cards in one unwindowed `{#each}`.
- The current full-card screenshot is 37,601 px tall, consistent with hundreds of live card nodes.

**User scenario and impact**

Opening or filtering the catalog on a lower-end phone pays a large JSON parse and DOM/layout cost. Search/filter interactions risk delayed response, and the page is impractical to browse without pagination.

**Recommended fix**

Ship a compact summary index for the grid, lazy-load a card's full rules on selection, and paginate or virtualize the catalog. Preserve filter/search state and expose result counts/pagination semantically.

---

### D-13 — The upload landing page eagerly includes every parser

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (source, production build, live resource timing)

**Evidence**

- `apps/web/src/components/upload/FileDropzone.svelte:1-7` imports the store and parser detection synchronously.
- `apps/web/src/lib/parser/index.ts:1-19` statically imports CSV, XLSX, PDF, JSON, OFX, and HTML implementations.
- The home route's loaded store/parser chunk decoded to **856,146 bytes** (243,837 transferred) in Chromium; total initially decoded script/style was roughly 950 KB in the local preview.
- The production build warned about a JavaScript chunk larger than 500 KB.

**User scenario and impact**

Users wait for spreadsheet and PDF code before they have chosen a file or asked to analyze anything. This competes with input readiness on the key acquisition screen and increases parse/compile work on mobile.

**Recommended fix**

Load the analyzer only when analysis begins, and dynamically import the parser selected by detected format. Keep lightweight format detection separate. Consider a less eager Astro hydration directive after confirming keyboard/file-input readiness.

---

### D-14 — Card loading and fetch-error states are not announced and provide no retry

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (source)

**Evidence**

- `apps/web/src/components/cards/CardGrid.svelte:160-176` renders an animated skeleton with no `aria-busy`/status label, then a plain error `<div>` with no `role="alert"` or retry action.
- `apps/web/src/components/cards/CardDetail.svelte:108-121` has the same pattern; its skeleton also lacks dark variants for the main blocks.
- Fetch is initiated only on mount/effect (`CardGrid.svelte:86-93`; `CardDetail.svelte:86-105`), so the user cannot explicitly recover from a transient failure.

**User scenario and impact**

Assistive-technology users receive no indication that card content is loading or has failed. All users must reload/navigate away to retry, and a dark-theme detail skeleton flashes conspicuously light gray.

**Recommended fix**

Mark the content region `aria-busy`, include a visually hidden polite loading status, use `role="alert"` for terminal errors, and add a retry button that starts a fresh request. Apply theme-safe skeleton tokens and reserve final geometry to minimize layout shift.

---

### D-15 — Filter selections are visually encoded but not exposed as state

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (source/accessibility inspection)

**Evidence**

- Card type and issuer pills at `apps/web/src/components/cards/CardGrid.svelte:124-158` indicate selection only through fill/border color; they lack `aria-pressed`, group names, and fieldset/legend semantics.
- The search control at `CardGrid.svelte:98-112` relies on a placeholder instead of a persistent visible label.
- Recommendation sort pills similarly expose their active state only visually at `apps/web/src/components/dashboard/OptimalCardMap.svelte:62-77`.
- The “카드별 상세 보기” disclosure at `apps/web/src/components/dashboard/SavingsComparison.svelte:267-314` does not expose `aria-expanded` or `aria-controls`.

**User scenario and impact**

A screen-reader user cannot determine the selected card type, issuer, or sort order. A speech-input user has no durable label for search, and the savings detail control does not announce whether content is open.

**Recommended fix**

Use labeled groups and toggle buttons with `aria-pressed`; give search a persistent `<label>`; and implement disclosure state with `aria-expanded`/`aria-controls`. Keep color as reinforcement, not the only state cue.

---

### D-16 — Mobile menu does not expose disclosure or current-page state

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (live keyboard/state inspection and source)

**Evidence**

- The menu button at `apps/web/src/layouts/Layout.astro:105-127` has a permanent “메뉴 열기” label and no `aria-expanded` or `aria-controls`.
- `apps/web/public/scripts/layout.js:40-76` opens/closes the region but never synchronizes those attributes or the label.
- Active desktop/mobile links are styled by `isActive` at `Layout.astro:71-88` and `Layout.astro:131-156`, but do not receive `aria-current="page"`.
- Live testing confirmed `aria-expanded=null`, `aria-controls=null`, and `aria-current=null`; focus moved to the first link and Escape restored the button, so focus movement itself works.
- `layout.js:78-96` traps focus in what is an inline navigation disclosure, although it is not marked modal and leaves the rest of the document uninert.

**User scenario and impact**

Screen-reader users cannot tell whether the menu is open or which page is current. The modal-like focus behavior does not match the control's semantics.

**Recommended fix**

Add `aria-controls`, synchronize `aria-expanded` and “메뉴 열기/닫기,” and add `aria-current="page"` to active links. For an inline disclosure, allow normal tab order; if it is intended to be modal, implement a proper dialog with inert background and dialog semantics.

---

### D-17 — Hero supporting text does not consistently meet contrast

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (live computed styles and contrast calculation)

**Evidence**

- `apps/web/src/pages/index.astro:11-28` places `text-white/85` and `text-white/60` over a blue-purple-pink gradient.
- Computed subtitle contrast at the three gradient anchors was approximately **4.19:1, 4.55:1, and 2.93:1**.
- Privacy text contrast was approximately **2.85:1, 3.01:1, and 2.12:1**.

**User scenario and impact**

The privacy assurance—a trust-critical statement for uploaded financial records—is the least legible text in the hero and fails everywhere on the gradient. The subtitle also fails across much of the background.

**Recommended fix**

Use opaque white or place supporting copy on a stable translucent dark scrim/solid region. Test the worst point of the gradient, not just one representative background.

---

### D-18 — Results printing can retain dark-theme utility colors

**Severity:** Medium
**Confidence:** High
**Status:** Code-confirmed; final visual print verification required

**Evidence**

- Results invokes `window.print()` directly at `apps/web/src/pages/results.astro:102-110`.
- The report route explicitly removes `.dark` before printing at `apps/web/src/pages/report.astro:67-81`, demonstrating that dark variants otherwise remain active.
- Global print CSS at `apps/web/src/app.css:88-100` resets body/nav/footer only, not descendant `dark:` utility backgrounds and text colors.

**User scenario and impact**

A dark-mode user printing the results can receive dark table cells, badges, or low-contrast colors on paper/PDF, unlike the dedicated report route.

**Recommended fix**

Reuse a single print helper on both routes or define comprehensive print-specific semantic tokens/utilities. Add light/dark print screenshot tests.

---

### D-19 — Report tables have no narrow-screen adaptation

**Severity:** Medium
**Confidence:** Medium
**Status:** Source-confirmed risk; manual populated-report verification required

**Evidence**

- `apps/web/src/components/report/ReportContent.svelte:32-63`, `:65-100`, and `:102-135` use `overflow-hidden` around tables.
- The assignment table has five padded columns (`ReportContent.svelte:69-99`) and no minimum width, horizontal scroll, responsive card layout, or abbreviated mobile values.
- The report container itself adds `p-8` at `apps/web/src/pages/report.astro:55-61`, further reducing a phone's usable width.

**User scenario and impact**

A user reviewing or sharing the report on a phone is likely to see aggressively wrapped or clipped cells, especially long Korean card names and currency values.

**Recommended fix**

Use stacked key/value cards below the tablet breakpoint or a labeled, keyboard-focusable horizontal scroll region with a deliberate table minimum width. Verify populated report output at 320, 375, and 400 CSS px and 200% zoom.

---

### D-20 — Empty dashboard copy contradicts its own state

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed (source and live empty route)

**Evidence**

- `apps/web/src/pages/dashboard.astro:29-33` always says “분석이 끝났어요.”
- Immediately below, the initial empty state at `dashboard.astro:35-48` says “아직 분석 결과가 없어요.”

**User scenario and impact**

Following a direct link or a lost/restored session presents mutually exclusive status messages, making users wonder whether analysis completed but results disappeared.

**Recommended fix**

Make the page subtitle state-driven through the same store-aware component that toggles content: “명세서를 올려 분석을 시작하세요” when empty, “분석이 끝났어요” only after a successful result, and an explicit restore/error message when applicable.

---

### D-21 — Error copy understates the formats the product accepts

**Severity:** Low
**Confidence:** High
**Status:** Confirmed (source)

**Evidence**

- `apps/web/src/components/upload/FileDropzone.svelte:97-106` accepts CSV, Excel, PDF, JSON, OFX/QFX, and HTML.
- The empty-state help accurately lists those families at `FileDropzone.svelte:498-508`.
- Invalid-file feedback at `FileDropzone.svelte:221-227` says only “CSV, Excel, PDF 파일만 지원합니다.”

**User scenario and impact**

A user who knows the app supports OFX or JSON receives contradictory recovery guidance after choosing the wrong file.

**Recommended fix**

Generate accepted-format help/error copy from one shared format definition so validation and messaging cannot drift.

---

### D-22 — Reduced-motion handling leaves smooth scrolling enabled

**Severity:** Low
**Confidence:** High
**Status:** Confirmed (source)

**Evidence**

- `apps/web/src/app.css:47-49` globally enables `scroll-behavior: smooth`.
- `apps/web/src/app.css:102-109` shortens animations/transitions for `prefers-reduced-motion` but does not reset scrolling.
- `apps/web/src/components/cards/CardPage.svelte:29-39` also explicitly requests smooth scrolling for card navigation.

**User scenario and impact**

Users who ask the operating system to minimize motion still receive animated page movement.

**Recommended fix**

Set `html { scroll-behavior: auto; }` inside the reduced-motion query and conditionally avoid `behavior: "smooth"` in script.

---

### D-23 — The declared favicon URL returns 404

**Severity:** Low
**Confidence:** High
**Status:** Confirmed (source and live request)

**Evidence**

- `apps/web/src/layouts/Layout.astro:54` requests `${base}favicon.svg`.
- The public asset is `apps/web/public/icon.svg`; no `favicon.svg` exists.
- The preview request to `/cherrypicker/favicon.svg` returned HTTP 404.

**User scenario and impact**

Tabs/bookmarks show a generic icon and every page adds a failed request. This is minor but visible polish.

**Recommended fix**

Point the link to `icon.svg` or rename/copy the asset consistently, then add a smoke assertion for a 200 favicon response under the configured base path.

---

### D-24 — Current responsive/accessibility tests are too shallow to catch the live failures

**Severity:** Low
**Confidence:** High
**Status:** Confirmed (test/source comparison)

**Evidence**

- Responsive coverage at `e2e/ui-ux-review.spec.js:537-574` asserts that the menu appears, the desktop nav disappears, and a `.grid-cols-2` locator is visible; it does not assert element geometry, usable chart-track width, meaningful table width, or document overflow.
- Form-label coverage at `e2e/ui-ux-review.spec.js:479-492` accepts a placeholder as sufficient naming, while the theme check at `e2e/ui-ux-review.spec.js:511-516` checks only that a label exists. The suite does not validate toggle state (`aria-pressed`/`aria-expanded`), current-page state, nested interactive content, or preservation of table roles.
- Mobile screenshots are captured at `e2e/ui-ux-screenshots.spec.js:110-141`, but there is no dimensional or semantic assertion paired with them.
- Consequently, the current suite can pass while the live category bars are 0 px, the savings bars are 11 px, and data rows expose themselves as buttons outside the table.

**User scenario and impact**

Regressions repeatedly survive CI because tests confirm presence rather than usability.

**Recommended fix**

Add focused assertions for computed geometry at 320/375 px, accessibility-tree roles/names/states, one-drop/one-file behavior, color contrast tokens, 200% zoom, reduced motion, and light/dark print output. Keep visual snapshots, but pair them with semantic and dimensional invariants.

---

### D-25 — Report/card tables rely on horizontal density without discovery cues

**Severity:** Medium
**Confidence:** Medium
**Status:** Confirmed in card detail; report portion requires populated mobile validation

**Evidence**

- Card detail uses a horizontally scrollable table at `apps/web/src/components/cards/CardDetail.svelte:217-258`, but the scroll region has no accessible label, focus target, edge affordance, or instruction.
- Report tables at `apps/web/src/components/report/ReportContent.svelte:32-135` are even less discoverable because their wrappers hide overflow.
- Currency and Korean card names are long, while all table cells retain desktop padding.

**User scenario and impact**

Keyboard users may not be able to pan an otherwise scrollable region, and touch users receive no cue that additional columns exist off-screen. Where overflow is hidden, the data can simply disappear.

**Recommended fix**

Prefer responsive card layouts for the decision-critical mobile view. Where a true data table is necessary, use a focusable, labeled scroll container (`tabindex="0"`, region name), a visible edge/scroll hint, sensible `min-width`, and sticky headers/identity columns.

---

## Cross-cutting design guidance

The first implementation plan should treat these as connected system problems, not isolated Tailwind tweaks:

1. Define theme-aware semantic foreground/fill tokens and a tested issuer presentation map.
2. Refactor upload interaction into valid native controls, then correct drop/error/warning/validation state.
3. Preserve semantic tables and disclosures while creating narrow-screen list/card variants for decision content.
4. Surface “complete with warnings” as a first-class analysis outcome.
5. Split heavy card/parser data from the landing route and render long catalogs incrementally.

## Browser/process ownership note

The review used a named browser session and a repository preview on port 4173. During the run, the named session unexpectedly routed to an unrelated page titled “Travelback - Animate Your Journeys” on `127.0.0.1:41861`; this indicates shared agent-browser routing contention. I stopped interacting immediately and did not close or signal the externally active Travelback daemon/browser tree (`45037`/`45069`). Only the browser daemon/Chrome tree created for this review (`8676`/`8722`) and the CherryPicker preview (`29698`) are in cleanup scope. Final process and port state is recorded after cleanup below.

**Cleanup verification:** review-owned daemon `8676`, Chrome root `8722`, attributable crash handlers `8742`/`8745`, and preview `29698` are no longer present; no process with the attributable `agent-browser-chrome-e1d5…` profile remains; TCP 4173 has no listener. The externally active Travelback daemon/Chrome root `45037`/`45069` remained present and untouched. No `/Applications/Google Chrome` process was signaled.
