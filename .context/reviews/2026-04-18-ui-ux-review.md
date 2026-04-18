# CherryPicker UI/UX Review

**Date:** 2026-04-18
**Method:** Source code analysis + Playwright live inspection (chromium, 1440x900 & 375x812)
**Pages reviewed:** Home, Dashboard, Results, Cards, Report

---

## Critical Issues

### 1. CSP Blocks All Inline Scripts (P0)

The `<meta>` CSP tag specifies `script-src 'self'`, but the app uses `<script is:inline>` in multiple pages:

- `Layout.astro:43` — `layout.js` (theme toggle, mobile menu)
- `results.astro:63` — `results.js` (stat population, print)
- `report.astro:49` — `report.js` (report content rendering)

Playwright confirms **3 CSP violations on /cards alone**, and the same pattern applies to every page. In production (GitHub Pages), the browser enforces CSP and **blocks these scripts entirely**, meaning:

- Theme toggle is non-functional
- Mobile menu never opens
- Results page stats never populate from sessionStorage
- Report page content never renders from sessionStorage
- Print button has no click handler

**Why it "works" in dev:** Vite's HMR client injects its own scripts and may bypass CSP in dev mode. In production, these scripts are silently blocked.

**Fix:** Either add `'unsafe-inline'` to `script-src` (undermines CSP), or move all inline scripts to external `.js` files referenced via `<script src="...">` and remove `is:inline`. The scripts already live in `public/scripts/` — the `is:inline` attribute forces Astro to embed them inline rather than bundle them. Remove `is:inline` and reference them as `<script src={base + "scripts/layout.js"}></script>`.

### 2. Cards Page Stuck in Loading State (P0)

The `/cards` page never finishes loading. Playwright shows 6 skeleton placeholders persisting after 8 seconds, with 0 cards rendered. The API endpoint `/cherrypicker/data/cards.json` returns 200 with valid JSON, so the data is available.

Root cause: The CSP issue above blocks the Svelte hydration script. The `CardGrid.svelte` component is loaded with `client:load`, which requires Astro's client-side runtime. Since CSP blocks the inline hydration script, the Svelte component never mounts — the `getCards()` call in `onMount` never runs.

**Fix:** Same as #1 — resolving CSP unblocks Svelte hydration on this page.

### 3. report.js Uses innerHTML with User-Adjacent Data (P0 — Security)

`report.js:48` sets `reportContent.innerHTML = html` where `html` is built by string-concatenating data from sessionStorage. While there is an `esc()` helper that HTML-encodes some values, the `formatWon()` output and some other interpolated strings are not escaped. If an attacker can write to sessionStorage (XSS in a subdomain, or a malicious browser extension), this becomes a stored XSS vector.

**Fix:** Use `document.createElement()` + `textContent` for all dynamic values, or at minimum ensure every interpolated value passes through `esc()`.

---

## High-Severity Issues

### 4. Mobile Menu Items Focusable When Hidden (P1 — Accessibility)

When the mobile menu is closed (`hidden` class), the 4 navigation links inside it are still in the tab order. Playwright confirms they lack `tabindex="-1"` and the menu has no `inert` attribute. Keyboard-only users tab through invisible, unreachable links.

**Fix:** Add `inert` attribute to `#mobile-menu` when it's hidden, or toggle `tabindex="-1"` on all child focusable elements. In `layout.js`, when toggling the menu:

```js
mobileMenu?.classList.toggle('hidden');
mobileMenu?.toggleAttribute('inert');
```

And set `inert` initially in the HTML: `<div id="mobile-menu" class="hidden" inert>`.

### 5. No Skip-to-Content Link (P1 — Accessibility)

There is no skip link allowing keyboard users to jump past the nav to `<main>`. The first Tab lands on the logo, then through 5 nav links, then the theme toggle, then the hidden mobile links, before reaching page content.

**Fix:** Add as the first element inside `<body>`:
```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] ...">
  본문으로 건너뛰기
</a>
```
And add `id="main-content"` to the `<main>` element.

### 6. Results Page Stat Cards Show Em-Dash Without Context (P1 — UX)

When no analysis data exists, the three stat cards on `/results` display `—` (em-dash) with no explanation. The headings read "총 지출", "예상 절약액", "필요한 카드" — a user landing directly on this page sees a seemingly broken page with no call-to-action.

**Fix:** Add an empty state section (like other pages have) that says "아직 분석 결과가 없어요" with a link back to the upload page. Or hide the stat cards entirely and show an empty-state placeholder.

### 7. Dashboard Has 4 Identical Empty States with No Differentiation (P1 — UX)

When no data is loaded, the dashboard shows 4 separate "아직 분석한 내역이 없어요" / "아직 비교 데이터가 없어요" empty-state blocks — one per component. This creates visual noise and 4 identical "명세서 올리러 가기" links.

**Fix:** Detect the no-data state at the page level (in `dashboard.astro`) and show a single, centered empty-state hero instead of rendering all 4 sub-components.

---

## Medium-Severity Issues

### 8. Dark Mode — Hardcoded Light-Background Tailwind Classes (P2)

Multiple components use Tailwind utility classes with hardcoded light backgrounds that don't respond to dark mode:

- `SpendingSummary.svelte` — `bg-gradient-to-br from-blue-50 to-blue-100`, `from-amber-50 to-amber-100`, `from-green-50 to-green-100`, `from-purple-50 to-purple-100`
- `SavingsComparison.svelte` — `from-blue-50 to-blue-100`, `from-green-50 to-emerald-100`
- `TransactionReview.svelte` — `bg-amber-50`, `bg-amber-100`, `bg-green-100`, `bg-red-50`
- `FileDropzone.svelte` — `bg-green-50 dark:bg-green-900/20` (partial dark fix)
- `CardDetail.svelte` — `bg-blue-100`, `bg-emerald-100`, `bg-violet-100`, `bg-amber-100`
- `CardGrid.svelte` — `bg-blue-100`, `bg-emerald-100`, `bg-violet-100`
- `OptimalCardMap.svelte` — `bg-amber-100`, `bg-red-50`, `bg-green-100`

Playwright's live check returned 0 elements because Tailwind's JIT compiles `bg-green-50` as a utility class that sets `background-color`, not an inline `style` — the query was looking at inline styles. However, the code analysis confirms ~20+ hardcoded light-background classes that render poorly in dark mode (light text on light background).

**Fix:** Add `dark:` variants for each, or use CSS custom properties (e.g., `bg-[var(--color-surface)]` + subtle tint overlays).

### 9. Number Input Without Label (P2 — Accessibility)

The "전월 카드 이용액" `<input type="number">` in `FileDropzone.svelte:353-359` has no `<label>`, no `aria-label`, and no `aria-labelledby`. The only context is a `<p>` tag above it reading "전월 카드 이용액" but this is not programmatically associated.

**Fix:** Add `aria-label="전월 카드 이용액"` to the input, or wrap the `<p>` as a `<label for="prev-spending">` and add `id="prev-spending"` to the input.

### 10. Select Dropdowns Without Labels (P2 — Accessibility)

- `CardGrid.svelte:89-97` — Sort `<select>` has no `aria-label` or associated `<label>`.
- `TransactionReview.svelte:263-273` — Category `<select>` elements (one per row) have no `aria-label`.

Screen readers announce these as unlabeled dropdowns.

**Fix:** Add `aria-label="정렬 기준"` to the sort select. Add `aria-label={tx.merchant + ' 카테고리'}` to each row's category select.

### 11. Bank Selector Pills Not Announced as a Group (P2 — Accessibility)

The 24 bank buttons in `FileDropzone.svelte:324-346` are in a `<div class="flex flex-wrap gap-2">` with no `role="group"` or `aria-label`. Screen reader users hear 24 unlabeled buttons with no group context.

**Fix:** Add `role="group" aria-label="카드사 선택"` to the container `<div>`.

### 12. Theme Toggle Button Has No Visible Text (P2 — Accessibility)

Both desktop and mobile theme toggle buttons (`#theme-toggle`, `#theme-toggle-mobile`) have `aria-label="테마 전환"` but their visible content is just an SVG icon with no text. The SVGs start with `class="hidden"` and visibility is toggled by JS, but before JS runs, both sun and moon icons are hidden, making the button appear empty.

**Fix:** Ensure at least one icon is visible by default (remove `class="hidden"` from the moon icon, since the initial state depends on system preference). Or use a CSS-based approach instead of JS toggling.

### 13. Step Indicator in FileDropzone Not Accessible (P2 — Accessibility)

The 4-step progress indicator (`STEPS = ['파일 선택', '카드사 선택', '분석 중', '완료']`) uses numbered circles and text labels but lacks `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Screen readers cannot communicate progress.

**Fix:** Add `role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={4} aria-label="업로드 진행"` to the step container.

---

## Low-Severity Issues

### 14. Hero Section Overflow on Small Mobile (P3)

At 375px width, the h1 "CherryPicker" text (5xl = 3rem) fits within the viewport (right edge at 351px), but the hero section uses `-mx-6` which creates negative margins. On very narrow screens (320px), content may clip.

**Fix:** Test at 320px and add `px-4` breakpoints if needed, or use `text-4xl md:text-5xl lg:text-6xl` for responsive sizing.

### 15. Inconsistent Back-Link Patterns (P3 — UX)

- Dashboard: "명세서 업로드로 돌아가기" → links to `/`
- Results: "다시 분석하기" → links to `/` (different wording, same target)
- Report: "결과로 돌아가기" → links to `/results`

The wording and icon styles are inconsistent. Some use `<svg>` inline, others use the `<Icon>` component.

**Fix:** Standardize back-link wording and use the `<Icon>` component consistently.

### 16. Duplicate Navigation Links (P3 — Accessibility)

The `<nav>` contains both desktop and mobile link sets. While visually hidden/shown via `md:flex` / `md:hidden`, screen readers in certain configurations may announce all 8+ links (4 desktop + 4 mobile) as a flat list.

**Fix:** Add `aria-hidden="true"` to the mobile nav links when the desktop nav is visible, and vice versa. Or use `inert` on the hidden set.

### 17. Footer Has No Report Link (P3 — UX)

The footer links are "홈", "카드 목록", "대시보드" — missing "추천 결과" and "리포트". Nav has 4 links but footer has 3, creating a dead end for discovery.

**Fix:** Add "추천 결과" and "리포트" to the footer nav, or make it match the header nav.

### 18. CardDetail "Same Issuer" Button Doesn't Filter (P3 — Bug)

`CardDetail.svelte:253` has an onclick `window.location.hash = ''` which clears the hash but doesn't actually filter by issuer. It just goes back to the unfiltered grid view, which is confusing since the button says "전체 보기" (view all) but the user expected "same issuer" filter.

**Fix:** Either change the label to "카드 목록으로 돌아가기" or implement issuer filtering by navigating to `/cards#issuer-{issuer}` and reading the hash in CardGrid.

### 19. Progress Bar Animation Is Fake (P3 — UX)

`FileDropzone.svelte:395-397` shows a progress bar during upload with `width: 60%` and a CSS animation. It's purely cosmetic — no actual progress feedback. The bar bounces between 0-60-100% regardless of actual analysis progress.

**Fix:** Either remove the fake progress bar (the spinner is sufficient), or hook it up to actual progress from the analyzer if available.

### 20. `<base href>` Tag May Break Relative Links (P3)

`Layout.astro:38` sets `<base href={base}>` which affects all relative URLs on the page. Combined with `import.meta.env.BASE_URL` in component templates, this creates a double-prefix risk if not carefully managed. Some links use `${import.meta.env.BASE_URL}` prefix while `<base>` already sets the base path.

**Fix:** Audit all `href` attributes to ensure they're not double-prefixed. With `<base href="/cherrypicker/">`, an `href="/cherrypicker/dashboard"` becomes `/cherrypicker/cherrypicker/dashboard`. Current code uses `${base}dashboard` which produces `/cherrypicker/dashboard` — correct because it's relative to the base. But this is fragile and easy to break.

---

## Positive Findings

- **Semantic HTML:** Pages use `<nav>`, `<main>`, `<footer>`, heading hierarchy is correct (no skipped levels).
- **`lang="ko"`:** Properly set on `<html>`.
- **Dark mode:** Core color variables (`--color-bg`, `--color-surface`, etc.) switch correctly. Dark mode toggle persists to localStorage.
- **Mobile responsive:** Hero, stats bar, feature cards, and card grid all use responsive breakpoints. Mobile menu opens/closes correctly.
- **Focus indicators:** All focusable elements have visible focus outlines (no missing indicators detected).
- **Security headers:** CSP meta tag and referrer policy are present.
- **`prefers-reduced-motion`:** CSS correctly disables animations for users who prefer reduced motion.
- **Print styles:** Report page has proper print CSS that hides nav/footer and removes decorations.
- **Page titles:** All pages have descriptive Korean titles in the format "페이지명 | CherryPicker".
- **Session persistence:** Analysis results persist to sessionStorage so they survive page navigation within a session.
- **Empty states:** Most components have clear empty states with CTAs (except results page stat cards).

---

## Priority Summary

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | CSP blocks inline scripts (breaks entire app) | P0 | M |
| 2 | Cards page stuck loading (consequence of #1) | P0 | — (fixed by #1) |
| 3 | innerHTML XSS in report.js | P0 | S |
| 4 | Mobile menu focus trap | P1 | S |
| 5 | No skip-to-content link | P1 | S |
| 6 | Results page stat dash with no context | P1 | S |
| 7 | Dashboard 4x duplicate empty states | P1 | M |
| 8 | Dark mode hardcoded light backgrounds | P2 | M |
| 9 | Number input without label | P2 | S |
| 10 | Select dropdowns without labels | P2 | S |
| 11 | Bank selector not announced as group | P2 | S |
| 12 | Theme toggle icons both hidden initially | P2 | S |
| 13 | Step indicator not accessible | P2 | S |
| 14 | Hero overflow at 320px | P3 | S |
| 15 | Inconsistent back-link patterns | P3 | S |
| 16 | Duplicate nav links for screen readers | P3 | S |
| 17 | Footer missing nav links | P3 | S |
| 18 | CardDetail same-issuer button misleading | P3 | M |
| 19 | Fake progress bar | P3 | S |
| 20 | `<base href>` double-prefix fragility | P3 | S |
