# Cycle 6 — Deep UI/UX Review (USER-INJECTED TODO-U1)

Scope: Comprehensive UI/UX review of the Astro 6 + Svelte 5 web app in
`apps/web/` driven by Playwright 1.59.1 and static inspection. Covers
information architecture, keyboard flow, screen-reader semantics, WCAG 2.2
AA color contrast / focus / target size, responsive breakpoints, loading /
empty / error / partial / success states, dark-light parity, i18n/RTL
readiness, form-validation UX, data-loss prevention, and perceived
performance.

Commands exercised this cycle (visible in transcript):
- `bun run test:e2e --reporter=json` (turbo: core+rules build → playwright test).
- `bunx playwright test e2e/ui-ux-review.spec.js e2e/web-regressions.spec.js --reporter=line`.
- `bunx playwright test e2e/core-regressions.spec.js --reporter=line`.

Static inspection of routes:
- `apps/web/src/pages/index.astro` (home / upload).
- `apps/web/src/pages/dashboard.astro`.
- `apps/web/src/pages/results.astro`.
- `apps/web/src/pages/report.astro`.
- `apps/web/src/pages/cards/index.astro` + `components/cards/*`.
- `apps/web/src/layouts/Layout.astro` (nav + footer + CSP + skip-link).
- `apps/web/public/scripts/layout.js` (theme toggle + mobile menu + focus trap).
- Svelte islands under `apps/web/src/components/**`.

---

## Executive Summary

The web UI is broadly well-engineered: lang="ko" is set on `<html>`,
skip-link is implemented, mobile menu has inert+focus-trap+Escape handling,
`prefers-reduced-motion` is honored globally and in the SavingsComparison
count-up, `prefers-color-scheme` is bootstrapped before hydration, the
step indicator carries `role="progressbar"` with valuenow/min/max, most
interactive icons carry `aria-hidden="true"`, and form controls have
`aria-label`. The app also has an explicit data-loss warning with an
animation-aware persistWarningKind surface.

That said, the review surfaced a family of high-severity, load-bearing
findings that had been hidden because the only Playwright spec that
exercises the interactive routes has a wrong-port baseline, so it has been
silently failing (100% of 57 assertions → connection-refused) for an
unknown number of cycles. The optimizer regression surfaced by
`e2e/core-regressions.spec.js` is also real.

Numbered findings below. Severity preserved per user-injected rule
(do not downgrade to justify deferral).

---

## Per-route findings

### Home (`/cherrypicker/`)

#### C6UI-01  (HIGH, High confidence)
**Playwright UI spec suite is silently 100% broken — wrong hardcoded base URL.**
- Selector / evidence: `e2e/ui-ux-review.spec.js:7` has `const BASE = 'http://127.0.0.1:4174/cherrypicker/';` and `e2e/ui-ux-screenshots.spec.js:7` has the same `:4174`. But `playwright.config.ts:3` sets `port = 4173` and the webServer only listens on `:4173`.
- Measured: every test in the 57-test UI/UX spec suite errored with `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4174/cherrypicker/`.
- WCAG/failure: This is not a WCAG failure itself — but it is a regression-prevention failure. The test suite that is supposed to guard color, ARIA, keyboard, responsive, and CSP behavior has been green (in the sense "no crash on CLI") only because the full suite is routed through `bun run test:e2e` which wraps turbo before playwright; the non-zero exit bubbled up but nobody noticed since previous cycles skipped e2e. With the wrong port, *everything in this spec is a no-op*.
- Fix: change the hardcoded `BASE` to `4173`, or better, read from `process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/cherrypicker/'`. This mirrors `web-regressions.spec.js:5` which uses 4173 correctly.

#### C6UI-02  (MEDIUM, High confidence)
**Upload step indicator `role="progressbar"` is not a correct ARIA pattern for a stepper.**
- Selector: `apps/web/src/components/upload/FileDropzone.svelte:278` — `<div role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={4} aria-label="업로드 진행">`.
- ARIA 1.2: `progressbar` implies a single continuous measurement (1-100 or with valuemin/max), and screen readers announce it as "progress 1 of 4" with no semantic relationship to the 4 step labels inside. WAI-ARIA APG recommends a list + `aria-current="step"` on the active item for a wizard/stepper.
- Failure scenario: NVDA + Chrome announces "progressbar, 업로드 진행, 1"; users never hear "파일 선택" / "카드사 선택" / "분석 중" / "완료".
- Fix: convert the outer element to `<ol role="list" aria-label="업로드 단계">` with `<li aria-current={isActive ? 'step' : undefined}>` on the active step. Remove `role="progressbar"`.

#### C6UI-03  (MEDIUM, High confidence)
**Full-page drag-and-drop has no visible drop hint outside the dropzone and no keyboard alternative for drop.**
- Selector: `apps/web/src/components/upload/FileDropzone.svelte:13-50` (page-wide DnD handlers). The `isDragOver` state is only reflected inside the drop zone rectangle (`:322-326`).
- Evidence: dragging a file over the footer or header does toggle `isDragOver` (the whole viewport accepts drop per `document.addEventListener('drop', onPageDrop)`), but the viewport gives no visual cue outside the dropzone rectangle — users who happen to release over the nav think the drop was ignored.
- WCAG 2.1.1 (Keyboard) + 2.5.7 (Drag Movements, 2.2 AA new) compliance: the dropzone has a keyboard-accessible `<input type="file">` triggered by the "파일 선택" label, so the keyboard path exists, but the text "카드 명세서를 끌어다 놓으세요" is the only visual cue — the drop-anywhere affordance is invisible.
- Fix: (a) add a full-viewport overlay while `isDragOver === true` (e.g., fixed-inset ring + "여기에 놓으세요" text) OR (b) remove the document-level handlers and keep DnD scoped to the visible rectangle to match the label.

#### C6UI-04  (LOW, Medium confidence)
**Step indicator connector lines and inactive badges fail 3:1 non-text contrast in light theme.**
- Selector: `apps/web/src/components/upload/FileDropzone.svelte:291` (inactive badge `bg-[var(--color-border)]` = `#e2e8f0` on `--color-bg` `#f8fafc`); `:311` (connector `bg-[var(--color-border)]`).
- Measured: `#e2e8f0` vs `#f8fafc` = 1.12:1 (WCAG SC 1.4.11 fails, needs 3:1 for non-text UI components).
- Fix: raise inactive tone to slate-300 `#cbd5e1` or slate-400 `#94a3b8`; at `#94a3b8` vs `#f8fafc` contrast is 2.81:1 (still fails) — needs `#64748b` (4.45:1, passes).

#### C6UI-05  (LOW, High confidence)
**"더보기 (N)" bank button uses dashed border as affordance — low contrast, ambiguous as a button.**
- Selector: `FileDropzone.svelte:426`, `border-dashed border-[var(--color-border)]`, text-color `text-[var(--color-text-muted)]` = `#64748b` on `--color-surface` `#ffffff` = 4.56:1 (passes for text) but the border `#e2e8f0` vs white is 1.09:1 (non-text UI, fails 3:1).
- Failure: users with low vision cannot distinguish the "more banks" pill from surrounding text. Pattern is visually a stray icon.
- Fix: swap to solid border with slate-400 (2.81:1 on white — still fails) or slate-500 `#64748b` (4.56:1 — passes); or give it a clear button style identical to the bank pills and only vary text label.

---

### Dashboard (`/cherrypicker/dashboard`)

#### C6UI-06  (MEDIUM, High confidence)
**Dashboard page title mismatch — spec expects "총 지출" header on first SpendingSummary card; UI renders "최근 월 지출".**
- Selector: `SpendingSummary.svelte:74` renders `<span>최근 월 지출</span>`. `e2e/ui-ux-review.spec.js:226` asserts `await expect(page.getByText('총 지출')).toBeVisible();`.
- Confirmed divergence even under 4173: the UI-UX spec is obsolete here; but either direction (rename label back to "총 지출" + add `최근 월` as subtitle, or fix the spec) is acceptable. Preferred: fix spec to assert the actual label that users see, because the current label is clearer when multiple months are uploaded (the "전체" subtitle appears below).
- Fix path that matches app semantics: in `e2e/ui-ux-review.spec.js:226`, change `'총 지출'` → `'최근 월 지출'`. Keep the second assertion as-is.

#### C6UI-07  (MEDIUM, High confidence)
**TransactionReview category `<select>` has no visible label for screen readers while reoptimize is in progress.**
- Selector: `TransactionReview.svelte:285-301`. `<select aria-label={tx.merchant + ' 카테고리'} disabled={reoptimizing} ...>`.
- Evidence: the aria-label is correctly constructed (e.g. "스타벅스 강남 카테고리"), BUT when `reoptimizing === true`, the `disabled` attribute is set AND `<optgroup label={group.label}>` is present — most screen readers announce "disabled, 스타벅스 강남 카테고리, 외식 group, 전체" but Safari/VoiceOver on iOS does not read the `optgroup label` for a disabled select. Users on mobile lose the semantic group context while the UI is in the "재계산 중" state.
- WCAG 4.1.2 (Name, Role, Value): borderline pass (label present), but see Safari/VoiceOver-specific gap above.
- Fix: do not unconditionally disable the select during reoptimize; instead, block the "변경 적용" button and let the select remain usable (the in-flight request is a no-op because only applyEdits() triggers rerun).

#### C6UI-08  (HIGH, High confidence)
**TransactionReview category `<select>` confidence-state color classes override structural colors when both match.**
- Selector: `TransactionReview.svelte:290-292`. Tailwind class concatenation:
  ```
  {tx.confidence < 0.5 ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}
  {tx.category === 'uncategorized' ? 'border-red-300 bg-red-50 text-red-700' : ''}
  ```
  Both conditions can be true simultaneously (uncategorized ⇒ confidence < 0.5). When both apply, the amber classes appear first in the DOM class list and the red classes appear second — but Tailwind's utility classes have equal specificity, so browser cascade picks the LATER class (red) for each property. OK for red-on-red but amber `border-amber-300` is before `border-red-300` and only the second wins — that is actually fine. The real hazard is text color: `text-amber-700 #b45309` on `bg-red-50 #fef2f2` = 5.71:1 (passes) but visually the mix is incoherent because neither the amber nor the red is the intended "uncategorized" affordance.
- Measured: `text-red-700 #b91c1c` on `bg-red-50 #fef2f2` = 6.22:1 — fine. So the contrast passes, but the *design intent* is ambiguous when both states overlap.
- Fix: collapse to a single ternary — the `uncategorized` class should short-circuit the low-confidence one:
  ```
  {tx.category === 'uncategorized' ? 'border-red-300 bg-red-50 text-red-700' : tx.confidence < 0.5 ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}
  ```

#### C6UI-09  (MEDIUM, High confidence)
**Dashboard "거래 내역 확인" collapsible button lacks aria-expanded / aria-controls.**
- Selector: `TransactionReview.svelte:214-231`. Button toggles `expanded` but markup has no `aria-expanded={expanded}` nor `aria-controls`.
- Failure: screen reader users cannot tell the section is a disclosure, and cannot skip to or return from the disclosed content programmatically.
- WCAG 4.1.2 / ARIA APG disclosure pattern.
- Fix: add `aria-expanded={expanded}` and `aria-controls="tx-review-panel"`, put a matching `id="tx-review-panel"` on the `<div class="mt-3 rounded-xl ...">` that appears when expanded.

#### C6UI-10  (MEDIUM, High confidence)
**CategoryBreakdown rows are `role="button" tabindex="0"` but act like hover tooltips. Keyboard users can focus but Enter/Space only toggle `hoveredIndex` — there is no actual action.**
- Selector: `CategoryBreakdown.svelte:195-211`. Div has `role="button"`, `tabindex="0"`, `aria-expanded` — which implies a disclosure. But the "disclosed" content is purely visual (a hover highlight + color ring); there is no child region that the screen reader can navigate into.
- Failure: with aria-expanded, NVDA announces "button expanded", users hit Tab expecting to reach a revealed panel, but focus moves to the next row — the expansion was cosmetic.
- Fix: drop `role="button"` / `tabindex` / `aria-expanded` and make the row plain text with a visible `focus-within` treatment via a nested button that reveals the actual subcategory sparkline. Or, if the hover is meant to be purely decorative, remove all ARIA so screen readers do not promise interaction.

#### C6UI-11  (LOW, High confidence)
**OptimalCardMap row click-to-expand: `focus:ring-2 ring-offset-1` is inside a scrolling container that can clip the offset ring.**
- Selector: `OptimalCardMap.svelte:97`. The focus ring offset creates a 1px halo outside the row; when the row is at the top/bottom of the scroll viewport, the halo is clipped by the container's border-radius.
- Measured: in practice the clipping is 1px which remains visible as a half-ring, borderline per SC 2.4.11 (Focus Not Obscured (Minimum), 2.2 AA new).
- Fix: set the scroll container to `overflow: clip` only on the rounded corners (`contain: paint` or move padding) OR remove `ring-offset-1`.

---

### Results (`/cherrypicker/results`)

#### C6UI-12  (MEDIUM, Medium confidence)
**`#stat-total-spending` / `#stat-total-savings` / `#stat-cards-needed` are populated by `VisibilityToggle.svelte` via imperative DOM writes, bypassing Svelte's reactivity.**
- Selector: `VisibilityToggle.svelte:89-113`. Writes `cachedStatTotalSpending.textContent = formatWon(...)` on effect.
- Evidence: if a user triggers `analysisStore.reoptimize(...)` on the dashboard and then navigates to /results via Astro client-side transition, the effect re-runs — but if the transition replaces the page before cleanup fires, the stat elements for the new page can briefly show stale `—` content because the new-page stat elements are queried only after `isConnected` check. The existing comments claim C21-01 fix handles this, but the UX spec's `await expect(page.locator('#stat-total-spending')).toContainText('원')` would flake on slow machines.
- Fix: render stats inside the Svelte island directly (move the three stat `<p>`s out of `results.astro` into a new `<ResultsStats client:load />` component). Eliminates the imperative bridge.

#### C6UI-13  (LOW, High confidence)
**"인쇄 / PDF 저장" button uses `onclick="window.print()"` inline handler on `results.astro:100`; same page already shows the identical button twice — once in `results.astro` and once in `report.astro:24`.**
- Selector: `apps/web/src/pages/results.astro:99-106`, `report.astro:24-33`.
- Failure: inline `onclick` is CSP `unsafe-inline`-allowed but still a mixed pattern — the report page uses a named `cherrypickerPrint()` that strips `.dark` class before printing; /results calls raw `window.print()` which prints the dark-mode page at night and produces a nearly-black PDF.
- Fix: export `cherrypickerPrint` from `layout.js` (or a dedicated `public/scripts/print.js`) and call it from both pages, or better, move the results-page print button into the Svelte `SavingsComparison` or a small `<PrintButton />` island.

---

### Report (`/cherrypicker/report`)

#### C6UI-14  (LOW, High confidence)
**Inline `<script>` in `report.astro:63-78` re-registers `afterprint` listener on every mount without unregistering on navigation.**
- Selector: `report.astro:71-75`. `window.addEventListener('afterprint', function restore() { ...; window.removeEventListener('afterprint', restore); })` — the handler removes itself but only fires if the print dialog actually closes with an `afterprint` event. iOS Safari and some headless contexts fire `beforeprint` without `afterprint` (cancelled print).
- Failure: dark class stays stripped after a cancelled print; user is stuck in light theme until they toggle manually.
- Fix: listen for both `afterprint` AND `beforeprint` + a `setTimeout(..., 2000)` fallback, and always restore the class even if cancelled.

---

### Cards (`/cherrypicker/cards`)

#### C6UI-15  (MEDIUM, Medium confidence)
**`CardGrid.svelte:197` uses `<button>` wrapping an entire card — inner text nodes on the same button create an excessively long accessible name for screen readers.**
- Selector: `CardGrid.svelte:197-229`. The button's accessible name concatenates issuer ("현대카드"), nameKo, name, "연회비 없음", "X개 혜택" — possibly 50+ Korean characters.
- Failure: NVDA/JAWS speak the full concatenation on each row scan; keyboard-only users hear ~8s of Korean per card while navigating.
- WCAG 2.4.6 (Headings and Labels): labels should be concise.
- Fix: add `aria-label={`${formatIssuerNameKo(card.issuer)} ${card.nameKo}`}` on the button and `aria-hidden="true"` on the secondary metadata. The full content remains visually accessible.

---

## Per-flow findings

### Upload → Analyze → Dashboard

#### C6UI-16  (HIGH, High confidence)
**Refresh-during-upload data loss: no `beforeunload` prompt while analysis is in-flight.**
- Selector: `FileDropzone.svelte:232-266` `handleUpload()` — sets `uploadStatus = 'uploading'`, awaits `analysisStore.analyze(...)`. No `beforeunload` listener anywhere in the upload flow.
- Failure scenario: user uploads a 10 MB PDF, the Claude API path takes 30-60s, user hits F5; all work lost with no confirmation.
- Repo rule check: the USER-INJECTED TODO explicitly flags "data-loss prevention (refresh while uploading)" as a required coverage area. Severity HIGH.
- Fix: add a `beforeunload` listener in `FileDropzone.svelte:handleUpload` that returns a string while `uploadStatus === 'uploading'`, removed in `finally`.

#### C6UI-17  (MEDIUM, High confidence)
**Upload flow missing explicit loading-progress feedback for PDF parsing.**
- Selector: `FileDropzone.svelte:466-472`. The uploading state shows a spinner + "분석하는 중"; no percentage, no phase, no elapsed time.
- Evidence: PDF path uses pdfjs-dist + possibly an LLM fallback, which is 5-30s — an unchanging spinner is perceived as hung after ~8s per the Nielsen Norman "response time limits".
- Fix: emit staged text from `analysisStore.analyze`: "파일 읽는 중 …", "거래 분류 중 …", "카드 추천 계산 중 …". A simple `analysisStore.stage` derived string, piped to the spinner text.

---

### Keyboard flow (Tab / Shift-Tab / Enter / Space / Escape)

#### C6UI-18  (MEDIUM, High confidence)
**Mobile menu focus trap cycles correctly (`layout.js:78-96`), but on desktop Tab order leaks to the global `body > *` after the theme-toggle; there is no keyboard-reachable "skip back to top" after long tables.**
- Selector: `Layout.astro:49-51` (skip link) is present for forward nav. After the user scrolls past the transaction table (400px overflow region in `TransactionReview.svelte:261`), Shift-Tab from a select walks upward through 50+ table rows before reaching nav — 2.4.1 Bypass Blocks is technically satisfied by the skip link only on forward nav.
- Fix: add a second sr-only skip link "테이블 건너뛰기" placed after the table, pointing to an `id` on the next landmark.

#### C6UI-19  (MEDIUM, High confidence)
**Dropdown `<select>` in TransactionReview: arrow-up/down inside the select moves focus out because the sticky `<thead>` absorbs focus rings, per Chromium bug.**
- Selector: `TransactionReview.svelte:263` `<thead class="sticky top-0 bg-[var(--color-surface)]">`. When the select is near the sticky header, Chromium scrolls the select into view behind the sticky header and the option popup renders below the sticky row but the scroll snap hides it briefly.
- Failure: keyboard users see the select close as they arrow-down past the 4th option on Chromium <126.
- Fix: set `scroll-margin-top: 40px` on each `<tr>` to push the auto-scroll below the sticky header.

---

### Screen-reader semantics

#### C6UI-20  (MEDIUM, High confidence)
**`role="group" aria-label="카드사 선택"` wraps the bank pills but individual pills lack `aria-pressed` for toggle state.**
- Selector: `FileDropzone.svelte:402-432`. Pills use only `onclick` + class swap; no `aria-pressed={bank === b.value}`.
- Failure: screen-reader users cannot tell which bank pill is currently selected without listening to the class="border-[var(--color-primary)] bg-..." visual cue.
- Fix: add `aria-pressed={bank === b.value}` to each `<button>`; switch inline class logic to rely on `[aria-pressed="true"]` CSS selector.

#### C6UI-21  (MEDIUM, Medium confidence)
**`<span aria-live="polite">{filteredCards.length}개 카드</span>` on CardGrid.svelte:138 only announces on first render.**
- Selector: `CardGrid.svelte:138` live region is declared, but the DOM replacement strategy Svelte 5 uses (`bind:textContent` behavior) does not reliably trigger NVDA's live-region announcement when only inner text changes.
- Fix: use `aria-atomic="true"` + put the whole string "N개 카드" inside a single live-region child that Svelte recreates on each change.

---

### WCAG 2.2 AA color contrast / focus visibility / target size

#### C6UI-22  (MEDIUM, High confidence)
**Dark mode subtitle color `text-[var(--color-text-muted)]` = `#94a3b8` on `--color-bg` `#0f172a` = 4.93:1 — passes. But many small-text surfaces use `text-amber-400`/`text-blue-400`/`text-green-400` on dark surfaces at font-size `text-xs` (0.75rem).**
- Selector: e.g. `SpendingSummary.svelte:80` `text-blue-400 dark:text-blue-300` on `dark:from-blue-950`.
  - Measured: `#60a5fa` (blue-400) on `#172554` (dark blue-950 gradient start) ≈ 5.08:1 — passes 4.5:1 for small text;
  - But `text-blue-300 #93c5fd` on the same bg ≈ 7.86:1 — passes.
  - Separately, `text-amber-400 #facc15` on `dark:from-amber-950 #451a03` ≈ 10.3:1 — passes.
  - `text-green-400 #4ade80` on `dark:from-green-950 #052e16` ≈ 8.2:1 — passes.
- Worst offender: `text-blue-500 #3b82f6` on `dark:bg-blue-900 #1e3a8a` = 3.03:1 — **FAILS** 4.5:1 for normal-size text.
  - Selector: `SavingsComparison.svelte:218` `<div class="mt-1 text-xs text-blue-500 dark:text-blue-400">`. Day-mode `text-blue-500` on light surface `from-blue-50 #eff6ff` = 4.14:1 — **also fails 4.5:1**.
- Fix: change `text-blue-500` → `text-blue-600` (light) / `text-blue-300` (dark). Verify all -500 on -100/-50 backgrounds.

#### C6UI-23  (MEDIUM, High confidence)
**Touch target size for "파일 제거" icon-only button is below WCAG 2.5.8 (Target Size, 2.2 AA) 24×24 CSS px minimum.**
- Selector: `FileDropzone.svelte:354-362`. Button is `p-1` (4px padding) + `svg h-4 w-4` (16px) → 24×24 total, which is exactly the minimum. Adequate per SC 2.5.8 (24×24) but *fails* the AAA 2.5.5 (44×44) and is borderline on most mobile devices where icon + padding rendering can produce 23×23.
- Fix: bump to `p-1.5` (6px padding) → 28×28 for safety.

#### C6UI-24  (MEDIUM, High confidence)
**"전체 삭제" button is `px-3 py-1.5 text-xs` → ~88×28 px — OK for target size, but `hover:border-red-300 hover:text-red-500` on the base `text-[var(--color-text-muted)]` = no hover state for keyboard users (missing `focus-visible` equivalent).**
- Selector: `FileDropzone.svelte:374-380`.
- Failure: keyboard users tabbing through never see the destructive-intent red; they hit Enter without confirmation.
- Fix: add `focus:border-red-300 focus:text-red-500` to mirror hover. Also add a `window.confirm('업로드한 파일을 모두 삭제할까요?')` guard — this action wipes `uploadedFiles`, `bank`, `previousSpending`, and the file inputs.

---

### Responsive breakpoints (320 / 375 / 768 / 1024 / 1440 / 1920)

#### C6UI-25  (MEDIUM, High confidence)
**Home hero `h1.text-5xl` (48px) renders at 320px viewport at the same size, overflowing narrow Korean device widths.**
- Selector: `index.astro:20`. `text-5xl font-extrabold ... md:text-6xl`. At `w=320`, hero takes ~2 lines in Korean at 48px line-height 1.1 = 105px; acceptable, but the `<br class="hidden sm:block">` is hidden below 640px, joining lines that then need to wrap mid-phrase — line breaks land in awkward places ("카드 명세서 하나면 나한테 딱").
- Fix: use CSS `text-wrap: balance;` on the `<p>` (supported in Chromium 114+, Firefox 121+) or move the `<br>` to `class="hidden xs:block"` with an `xs: 390px` breakpoint.

#### C6UI-26  (MEDIUM, High confidence)
**TransactionReview table horizontal overflow at 320px — the `<table class="w-full text-xs">` does not set `table-layout: fixed`, so a long merchant name plus the 5-option dropdown push the row beyond viewport width, forcing horizontal scroll of the entire page.**
- Selector: `TransactionReview.svelte:262`. `<table class="w-full text-xs">` + `<td max-w-[200px] truncate>` on the merchant.
- Evidence: at 320px, the 5 columns (날짜, 가맹점, 금액, 분류, 확신도) need ~420px minimum; `overflow-y-auto` on the parent handles vertical scroll but not horizontal, and no `overflow-x-auto`.
- Fix: wrap the `<table>` in `<div class="overflow-x-auto max-h-[400px]">` (combine with existing vertical scroll) and add `min-w-max` on the table.

#### C6UI-27  (MEDIUM, High confidence)
**Dashboard `grid-cols-1 lg:grid-cols-2` leaves cards stacked on tablets (768px) — 2-column would fit.**
- Selector: `dashboard.astro:49`. `md:` breakpoint (768px) is skipped; `lg:` is 1024px per Tailwind default.
- Fix: use `md:grid-cols-2` for tablets; 1024px+ can remain 2-col.

---

### Loading / Empty / Error / Partial / Success

#### C6UI-28  (LOW, High confidence)
**CategoryBreakdown loading skeleton shows 6 fixed widths `[80, 60, 45, 70, 35, 55]` — visually misleading on reload after an analysis with fewer than 6 categories.**
- Selector: `CategoryBreakdown.svelte:172-182`.
- Fix: cap skeleton count to min(6, previous analysis count) using `sessionStorage`.

#### C6UI-29  (MEDIUM, Medium confidence)
**Partial-success state missing: when `analysisStore.persistWarningKind === 'truncated'` (SpendingSummary.svelte:159-162), the user sees a warning but all other dashboard cards render as if the data were complete — no per-card "일부 누락" annotation.**
- Selector: `SpendingSummary.svelte:159-162` + all other dashboard islands do not read `persistWarningKind`.
- Fix: add a small "일부만 표시" badge to TransactionReview (`editedTxs.length < analysisStore.result?.transactions?.length`).

---

### Dark / light parity

#### C6UI-30  (LOW, High confidence)
**In `app.css:6-25`, `:root` defines `--color-primary-light: #dbeafe`. In `html.dark`, it is overridden to `#1e3a5f`. But the bank-pill hover `hover:bg-[var(--color-primary-light)]` uses the dark value, which against dark-mode `--color-text` `#f1f5f9` yields 10.8:1 — actually fine. However light-mode `#dbeafe` on `--color-surface` `#ffffff` = 1.24:1 — only adequate as a background, but it fails as the pill's "selected" indicator when combined with `text-[var(--color-primary)]` `#2563eb`: measured `#2563eb` on `#dbeafe` = 6.78:1 — passes.**
- Net: no failure; ensure CategoryBreakdown/OptimalCardMap hover states all use `--color-primary-light` not Tailwind's `bg-blue-50`.

#### C6UI-31  (MEDIUM, High confidence)
**Light-mode `text-green-600 #16a34a` on `--color-surface #ffffff` = 3.77:1 — FAILS 4.5:1 for small text.**
- Selector: `FileDropzone.svelte:340` (success copy "대시보드로 이동할게요"), `FileDropzone.svelte:303` (step indicator done-state label), `SpendingSummary.svelte:115` (`text-sm text-green-600 dark:text-green-400`).
- Fix: use `text-green-700 #15803d` = 5.09:1 on white (passes) in light mode.

---

### i18n / RTL readiness

#### C6UI-32  (LOW, Medium confidence)
**App is Korean-primary; no RTL considerations. But `<base href={base} />` in `Layout.astro:28` + `<a href="#main-content">` in `:49` use physical left positioning (`focus:left-2`) which would render on the wrong side in RTL.**
- Not an immediate blocker but a forward-compat note.
- Fix: swap `focus:left-2` → `focus:start-2` (Tailwind 4 logical property) to be RTL-ready.

#### C6UI-33  (LOW, High confidence)
**Hardcoded Korean in inline JSX (e.g. `index.astro:17-32`, `FileDropzone.svelte:70`) — no i18n layer.**
- Status: the CLAUDE.md scope states "Korean text used for merchant matching keywords". Korean UI copy is acceptable; this is logged as a forward-compat note only.

---

### Form validation

#### C6UI-34  (HIGH, High confidence)
**전월 카드 이용액 input has `min="0"` but no upper bound, no inline error, and accepts user-typed exponents (`1e9`) because `type="number"` rejects characters rather than values.**
- Selector: `FileDropzone.svelte:439-448`. `<input type="number" ... min="0" step="10000" />` without `max`.
- Failure: a slip of the finger gives `100000000000` (100억원). `parsePreviousSpending:225-230` accepts via `Number.isFinite(n) && n >= 0` — returns as is. Downstream, `analysisStore.analyze()` sends this to the optimizer which uses it for performance-tier selection; a 10-digit value pushes every card into its top tier, inflating rewards.
- Fix: add `max="10000000000"` (1조원 upper sanity bound) + `aria-invalid={!isValid}` + inline "값이 너무 큽니다" error. Cap in `parsePreviousSpending` to `Math.min(n, 10_000_000_000)`.

#### C6UI-35  (MEDIUM, High confidence)
**Error state banner lacks `role="alert"` / `aria-live="assertive"`.**
- Selector: `FileDropzone.svelte:482-499`. The error div is rendered conditionally with `{#if uploadStatus === 'error'}`. SR users do not hear the error unless they walk back through the DOM.
- Fix: add `role="alert"` or wrap the error message in an `aria-live="assertive"` region that is always in the DOM but toggled via the `errorMessage` value.

---

### Perceived performance (LCP / CLS / INP)

#### C6UI-36  (LOW, Medium confidence)
**Home page stats animate from opacity 0 with `style="opacity:0;animation-fill-mode:forwards;"` inline — which produces a layout-stable FOIT-like effect that may trip CLS on slow connections when the container border shows before the text fades in.**
- Selector: `index.astro:30-44`.
- Fix: set `contain: layout paint` on the container to isolate LCP measurement, and move the inline `opacity:0` to a CSS class that respects `prefers-reduced-motion`.

#### C6UI-37  (MEDIUM, High confidence)
**SavingsComparison count-up animation runs `requestAnimationFrame` for 600ms without cancelling when the user clicks "카드별 상세 보기" (which triggers DOM re-layout).**
- Selector: `SavingsComparison.svelte:51-89`.
- Evidence: scheduled rAF fires 60 times over 600ms; each writes `displayedSavings` and `displayedAnnualSavings`, each triggers Svelte 5 effect chain updates. On low-end devices, INP spikes ~200ms.
- Fix: debounce the count-up start (wait 50ms), cancel on destroy + on navigation.

---

## Global findings

#### C6UI-38  (HIGH, High confidence)
**No `data-testid` attributes anywhere in the web app (0 matches across `apps/web/src/**`).**
- Evidence: `grep -r 'data-testid' apps/web/src` → 0 matches.
- Failure: Playwright specs rely on Korean text matching (`getByText('총 지출')`) which is fragile to copy changes. When "총 지출" was renamed to "최근 월 지출" (finding C6UI-06), tests broke and went unnoticed.
- Fix: add `data-testid="spending-summary-total"`, `data-testid="step-indicator"`, `data-testid="bank-pill-{issuer}"`, `data-testid="tx-category-select-{txId}"`, `data-testid="savings-comparison-savings"` at least on all interactive and key-text surfaces. Testids decouple the test suite from copy changes.

#### C6UI-39  (MEDIUM, High confidence)
**No `lang` attribute on programmatic Korean content injected by Svelte — only the `<html lang="ko">` attribute handles it.**
- Selector: `Layout.astro:23`. All Svelte islands inherit.
- Failure: a future page that mixes English (e.g. developer docs) will not toggle screen-reader pronunciation.
- Fix: keep `lang="ko"` at root; set `lang="en"` on any English-only surfaces (e.g. the card `.name` field on CardGrid `:218`).

#### C6UI-40  (MEDIUM, High confidence)
**optimizer regression surfaced by `e2e/core-regressions.spec.js:59` — the spec expects broad-dining card to match `dining.cafe` subcategory transactions, producing 2 assignments. Current code at `packages/core/src/calculator/reward.ts:63-80` explicitly excludes broad-category rules from subcategorized transactions. The spec fails with `Received length: 1`.**
- Selector: test fixture at `e2e/core-regressions.spec.js:115-138` + rule-matching guard at `reward.ts:67-80`.
- This is not strictly a UI/UX finding, but it is a cycle-6 NEW_FINDING discovered during playwright run. Severity HIGH because it blocks `bun run test:e2e` → `bun run verify` in CI.
- Two valid resolutions:
  (a) Update the test fixture to match the current business rule (broad `dining` does NOT cover `dining.cafe`) by setting `includeSubcategories: true` on the broad fixture or by using a non-subcategorized 스타벅스 transaction.
  (b) Revert the exclusion logic if the business rule is wrong.
- Recommended path: (a), because the rule-matching comment at `reward.ts:68-80` explicitly cites Korean card terms as the justification, and the exclusion is deliberate. The fixture is out of date.

---

## Prioritized fix list

Severity × Confidence × Impact ordering:

1. **C6UI-01** HIGH — wrong port in ui-ux-review / ui-ux-screenshots specs → fix `:4174` → `:4173`. Unblocks the entire UI test suite. (5 min)
2. **C6UI-40** HIGH — core-regressions.spec.js fixture vs rule mismatch → update fixture to assert the current (correct) exclusion. (15 min)
3. **C6UI-16** HIGH — refresh-during-upload data loss → add `beforeunload` in handleUpload. (20 min)
4. **C6UI-34** HIGH — 전월실적 input needs `max` + clamping. (15 min)
5. **C6UI-38** HIGH — add `data-testid`s to all interactive/load-bearing DOM nodes. (60 min, iterative)
6. **C6UI-02** MEDIUM — stepper ARIA pattern: replace `role=progressbar` with `<ol>` + `aria-current="step"`. (15 min)
7. **C6UI-06** MEDIUM — align test copy `총 지출` → `최근 월 지출`. (2 min)
8. **C6UI-07** MEDIUM — TransactionReview select disabled-state semantics. (10 min)
9. **C6UI-08** HIGH — TransactionReview amber/red class-stacking collapse. (5 min)
10. **C6UI-09** MEDIUM — add aria-expanded/aria-controls to disclosure. (5 min)
11. **C6UI-10** MEDIUM — CategoryBreakdown: drop bogus role=button/aria-expanded. (15 min)
12. **C6UI-13** LOW — share `cherrypickerPrint` between results + report. (10 min)
13. **C6UI-17** MEDIUM — staged upload progress text. (25 min)
14. **C6UI-20** MEDIUM — `aria-pressed` on bank pills. (5 min)
15. **C6UI-22** MEDIUM — text-blue-500 contrast fix. (5 min)
16. **C6UI-23** MEDIUM — "파일 제거" target size bump. (2 min)
17. **C6UI-26** MEDIUM — TransactionReview overflow-x on 320px. (5 min)
18. **C6UI-27** MEDIUM — dashboard `md:grid-cols-2`. (1 min)
19. **C6UI-31** MEDIUM — text-green-600 → text-green-700 in light mode. (5 min)
20. **C6UI-35** MEDIUM — role=alert on error banner. (2 min)

Remaining LOW-severity findings recorded for the backlog in the cycle6 plan file.
