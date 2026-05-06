# Designer Review — CherryPicker Web Frontend (Cycle 32)

**Reviewer:** designer (worker-10)
**Scope:** UI/UX, visual design, accessibility, responsive design, component patterns, design system consistency
**Date:** 2026-05-06

---

## Summary

The CherryPicker web frontend demonstrates mature design patterns: a CSS custom property token system, dark mode support, WCAG AA contrast awareness (explicitly documented in code), comprehensive empty states and loading skeletons, print-friendly reports, and accessible mobile navigation with focus trapping. However, the design token system is only partially adopted — many components bypass tokens with hardcoded Tailwind colors. Mobile data-dense views rely heavily on horizontal-scrolling tables. Several accessibility issues (contrast, touch interaction, animation) need attention.

**Verdict:** The UI is polished and user-friendly overall, but design system discipline and mobile responsiveness are the primary gaps.

---

## 1. Design Token System — Partially Implemented, Inconsistent Application

### Finding 1.1: Hardcoded Tailwind colors mixed with CSS custom properties
**Confidence: High** | **Files:** Multiple

The project defines a sound token layer in `app.css` (`--color-primary`, `--color-bg`, etc.) but components routinely bypass it with hardcoded Tailwind palette colors:

- `SpendingSummary.svelte:74-136` — Summary cards use `from-blue-50 to-blue-100`, `from-amber-50 to-amber-100`, `from-green-50 to-green-100`, `from-purple-50 to-purple-100` with explicit dark-mode overrides (`dark:from-blue-950`). These should derive from `--color-primary-light` and related tokens.
- `SavingsComparison.svelte:214-228` — The "cherry-pick" highlight card uses `from-blue-50 to-blue-100` / `dark:from-blue-950` instead of semantic tokens.
- `FileDropzone.svelte:448` — Success state uses `bg-green-100` / `dark:bg-green-900/30`.
- `CategoryBreakdown.svelte` — Entire category color map is hardcoded hex values.

**Why it's a problem:** Changing the brand primary color requires edits in both `app.css` AND dozens of component locations. Dark mode maintenance is fragile — a missed `dark:` override creates invisible UI elements.

**Suggested fix:** Extend `app.css` with semantic gradient tokens (e.g., `--gradient-surface-blue`, `--gradient-surface-green`) and replace all hardcoded Tailwind color utilities with token references. For category colors, consider a token map or CSS custom property per category.

---

### Finding 1.2: Category colors are not design tokens
**Confidence: High** | **File:** `CategoryBreakdown.svelte:8-89`

`CATEGORY_COLORS` is a hardcoded `Record<string, string>` of 80+ hex values. These colors are not tied to CSS variables, making them impossible to theme (e.g., for high-contrast mode, brand refresh, or user preference).

**Suggested fix:** Move category colors to CSS custom properties in `app.css` (e.g., `--category-dining: #ef4444;`) and reference them via `style="background-color: var(--category-{id})"`. This enables runtime theming and centralized color management.

---

### Finding 1.3: Shadow system applied inconsistently
**Confidence: Medium** | **Files:** `app.css:21-22`, `index.astro`, `dashboard.astro`, `results.astro`

`app.css` defines `--shadow-card` and `--shadow-card-hover`, but many components use Tailwind's `shadow-sm`, `shadow-md`, `shadow-lg`, or `shadow-inner` instead. This creates visual inconsistency — some cards feel heavier than others for no semantic reason.

**Suggested fix:** Audit all shadow usage. Reserve `shadow-sm` for subtle elevation (buttons, inputs), `--shadow-card` for content cards, and `--shadow-card-hover` exclusively for hover states. Eliminate `shadow-md`/`shadow-lg` outliers.

---

## 2. Accessibility & Inclusive Design

### Finding 2.1: Issuer badge text color has insufficient contrast for KB국민카드
**Confidence: High** | **File:** `formatters.ts:150-153`

`getIssuerTextColor` only marks `kakao` and `jeju` as needing dark text. However, `kb` uses `#ffb800` (bright yellow) as its background color. White text (`text-white`) on `#ffb800` yields approximately 1.4:1 contrast — far below WCAG AA 4.5:1 for text.

**Concrete failure:** KB국민카드 badges in `OptimalCardMap.svelte`, `CardGrid.svelte`, and `SavingsComparison.svelte` are essentially unreadable for users with low vision or on bright screens.

**Suggested fix:** Add `'kb'` to `darkTextIssuers`. Consider running all issuer color pairs through an automated contrast checker.

---

### Finding 2.2: Rate bars in OptimalCardMap are too thin
**Confidence: High** | **File:** `OptimalCardMap.svelte:125-129`

The rate comparison bar uses `h-1.5` (6px at default font size). On mobile devices or for users with motor/visual impairments, this is nearly invisible and provides minimal visual information.

**Suggested fix:** Increase to `h-2.5` or `h-3` (10–12px). Add `min-h-[8px]` for accessibility. Consider adding the numeric percentage as visible text, not just on hover.

---

### Finding 2.3: Step indicator connector lines are 1px tall
**Confidence: Medium** | **File:** `FileDropzone.svelte:408-412`

The step connector uses `h-px` (1px). On high-DPI displays this renders as a hairline; for users with visual impairments or on lower-resolution screens, the connection between steps may be imperceptible.

**Suggested fix:** Use `h-0.5` (2px) minimum for connector lines.

---

### Finding 2.4: Confidence badges use 10px text
**Confidence: Medium** | **File:** `TransactionReview.svelte:317-326`

Confidence level badges use `text-[10px]`. While the colored background helps, 10px is below the generally recommended minimum of 12px for body text and may be illegible on some devices.

**Suggested fix:** Increase to `text-xs` (12px) or add `min-font-size: 12px` in app CSS.

---

### Finding 2.5: CategoryBreakdown hover tooltip is mouse-only
**Confidence: High** | **File:** `CategoryBreakdown.svelte:201-275`

The expanded subcategory tooltip (`hoveredIndex === i`) only appears on `mouseenter`/`focusin`. On touch devices, tapping a category row triggers the `onclick` toggle (which sets `hoveredIndex` to `i` or `null`), but the tooltip positioning and interaction model is optimized for hover, not tap.

**Concrete failure:** Mobile users cannot reliably discover the "기타" category breakdown or see subcategory details.

**Suggested fix:** Redesign the "other" category expansion to use an explicit expand/collapse pattern (like `OptimalCardMap.svelte`'s `▼` chevron) instead of hover-dependent tooltips.

---

### Finding 2.6: Mobile menu lacks transition animation
**Confidence: Medium** | **Files:** `Layout.astro:129-156`, `layout.js:48-68`

The mobile slide-in menu toggles with `classList.add/remove('hidden')` — no fade, slide, or scale transition. This is a jarring UX compared to modern mobile menu patterns.

**Suggested fix:** Replace `hidden` with opacity/translate transitions. Use `transition-all duration-200` with `opacity-0 translate-y-[-10px]` for the hidden state.

---

### Finding 2.7: Hamburger menu lacks "open" animation
**Confidence: Low** | **File:** `Layout.astro:117-125`

The hamburger icon uses three static `<span>` lines. There is no animation to an X shape when the menu opens, which is a missed affordance cue.

**Suggested fix:** Animate the three lines into an X using `transform: rotate()` and `opacity` on the middle line.

---

### Finding 2.8: Dark mode toggle causes layout shift
**Confidence: Low** | **File:** `Layout.astro:88-116`

The theme toggle swaps `hidden` class between sun/moon SVGs. Because the SVGs have different visual weights, the button content visibly shifts when toggling.

**Suggested fix:** Use absolute positioning with both icons stacked, toggling `opacity-0` / `opacity-100` with a short crossfade transition.

---

## 3. Responsive & Mobile Design

### Finding 3.1: Tables are the primary mobile layout for complex data
**Confidence: High** | **Files:** `OptimalCardMap.svelte`, `TransactionReview.svelte`, `ReportContent.svelte`

Three major data-dense views use `<table>` layouts with `overflow-x-auto`. On mobile (under 640px), users must horizontal-scroll to see all columns. This is a poor mobile experience for a tool that users likely check on their phones.

**Concrete failure:** In `OptimalCardMap.svelte:80-168`, a user on a phone must scroll horizontally to see the reward rate and expand chevron. In `TransactionReview.svelte:273-337`, the transaction table is even wider (date, merchant, amount, category select, confidence badge).

**Suggested fix:** For mobile breakpoints, convert tables to card-based layouts. Each row becomes a card with stacked information. `OptimalCardMap` rows could become cards showing category, recommended card, and rate prominently. `TransactionReview` could use a compact card list with expandable details.

---

### Finding 3.2: Dashboard grid lacks consistent vertical rhythm
**Confidence: Medium** | **File:** `dashboard.astro:51-124`

The dashboard uses `grid-cols-1 gap-6 md:grid-cols-2` for the top row, but inner components have their own `mt-4` / `mb-4` margins. On mobile, the `mt-4` inside each component plus the `gap-6` grid gap creates uneven spacing.

**Suggested fix:** Remove internal top margins from dashboard child components; let the grid `gap` handle all spacing. Components should be spacing-agnostic when placed in layouts.

---

### Finding 3.3: CategoryBreakdown bar labels truncate too aggressively
**Confidence: Medium** | **File:** `CategoryBreakdown.svelte:228-231`

Category labels are constrained to `w-24` with `truncate`. Korean category names like "오프라인쇼핑" (10 chars) will truncate on mobile, losing meaning.

**Suggested fix:** Increase label width on larger breakpoints (`w-24 sm:w-32`) or allow wrapping with `leading-tight` and `line-clamp-2`.

---

## 4. Visual Hierarchy & Information Design

### Finding 4.1: Results page action buttons lack visual hierarchy
**Confidence: Medium** | **File:** `results.astro:89-127`

Four action buttons at the bottom of results use inconsistent hierarchy:
- "리포트 보기" — primary filled button (correct)
- "인쇄 / PDF 저장" — bordered button, same weight as tertiary actions
- "다시 분석하기" — bordered button
- "분석 자세히 보기" — bordered button

The secondary action (print) and tertiary actions (re-analyze, dashboard) are visually indistinguishable.

**Suggested fix:** Group actions hierarchically:
  - Primary: "리포트 보기"
  - Secondary: "인쇄 / PDF 저장" (use `bg-[var(--color-bg)] border-[var(--color-primary)] text-[var(--color-primary)]`)
  - Tertiary: "다시 분석하기", "분석 자세히 보기" (use plain text links or lighter bordered style)

---

### Finding 4.2: Error states lack visual richness
**Confidence: Medium** | **Files:** `CardGrid.svelte:175-176`, `CardDetail.svelte:120-121`

Error states are minimal `bg-red-50 p-4 text-sm text-red-700` blocks without icons, retry affordances, or structural skeleton. Compared to the polished empty states (which include icons and CTA buttons), error states feel unfinished.

**Suggested fix:** Create a reusable `<ErrorState>` component with an error icon, descriptive message, and retry/reset action, matching the empty state design language.

---

### Finding 4.3: Loading skeletons use gray-200/gray-300 regardless of theme
**Confidence: Medium** | **Files:** `SpendingSummary.svelte:63-69`, `CategoryBreakdown.svelte:179-190`, etc.

Skeleton loaders use `bg-gray-200` / `bg-gray-300` / `bg-gray-700` (dark). These colors don't adapt to the app's warm gray palette (`--color-border: #e2e8f0`). In dark mode, `bg-gray-700` may clash with `--color-surface: #1e293b`.

**Suggested fix:** Create skeleton tokens: `--skeleton-base` and `--skeleton-highlight` mapped to semantic surface colors. Or use `bg-[var(--color-border)]` with opacity variants.

---

### Finding 4.4: Hero section has negative margin breakout
**Confidence: Low** | **File:** `index.astro:11`

The hero uses `-mx-6 -mt-8` to break out of the parent container's padding. This is a fragile pattern — if the parent padding changes, the hero alignment breaks. It also complicates print styles.

**Suggested fix:** Use a full-width wrapper with `width: 100vw` and `margin-left: calc(-50vw + 50%)` or restructure Layout.astro to not pad the `<slot>` content, instead having each page manage its own horizontal padding.

---

## 5. Component Design Patterns

### Finding 5.1: Feature cards inline SVGs instead of using Icon component
**Confidence: Low** | **File:** `index.astro:91-115`

The three feature cards inline full SVG markup instead of using the project's `<Icon>` component. This duplicates icon rendering logic and makes the feature cards inconsistent with other icon usage.

**Suggested fix:** Add the feature card icons to `Icon.svelte`'s icon map and use `<Icon name="..." />`.

---

### Finding 5.2: Print styles duplicated across files
**Confidence: Low** | **Files:** `app.css:88-100`, `report.astro:84-103`

Print styles exist in both `app.css` and `report.astro`'s `<style>` block. The `report.astro` styles override `app.css` with `:global()` selectors, creating a maintenance burden.

**Suggested fix:** Consolidate all print styles into `app.css` only. Remove the report.astro style block.

---

### Finding 5.3: CardDetail loading skeleton doesn't suggest structure
**Confidence: Medium** | **File:** `CardDetail.svelte:108-119`

The loading skeleton is generic gray blocks (`h-28`, `h-7 w-56`). Unlike `CardGrid.svelte`'s skeleton which mirrors the card layout (issuer label, name, fee, badge), the detail skeleton doesn't suggest the final structure (header banner, title, tier steps, table).

**Suggested fix:** Design a structured skeleton that mirrors the final layout — a wide banner-shaped block, a title block, and a table-shaped block.

---

### Finding 5.4: VisibilityToggle uses DOM manipulation instead of declarative rendering
**Confidence: Medium** | **File:** `VisibilityToggle.svelte`

The component directly manipulates DOM class lists to toggle visibility. While functional, this pattern bypasses Svelte's declarative reactivity and makes the component harder to reason about. It also creates a split-brain where Astro renders empty/data states in HTML, then JS hides one.

**Suggested fix:** (Architectural) Render the empty state or data state conditionally within each page/component based on store state, rather than using a side-effect component to manipulate DOM visibility after mount. This would also improve initial paint (no flash of both states).

---

## 6. Animation & Motion

### Finding 6.1: animate-bounce on success checkmark is distracting
**Confidence: Low** | **File:** `FileDropzone.svelte:448`

The upload success checkmark uses `animate-bounce`. A bouncing checkmark is playful but can feel unprofessional for a financial tool. The global `prefers-reduced-motion` rule reduces animation duration, but `animate-bounce` may still trigger.

**Suggested fix:** Replace `animate-bounce` with a subtle `scale` pop (`transform: scale(0.8) → scale(1)` with `ease-out`) or remove animation entirely.

---

### Finding 6.2: Dashboard entrance animations fire on every mount, not just first load
**Confidence: Medium** | **File:** `dashboard.astro:54-123`

All dashboard cards use `animate-[slideUp_0.4s_*_ease_both]` with `opacity:0;animation-fill-mode:forwards`. When navigating back to dashboard from another page (e.g., via Astro View Transitions), these animations replay, causing content to slide up again even though the data hasn't changed.

**Suggested fix:** Track whether data was just uploaded vs. restored from store. Only animate on fresh data loads, not on navigation remounts.

---

## 7. Cross-File Consistency

### Finding 7.1: Card type badge colors are duplicated in multiple files
**Confidence: Medium** | **Files:** `CardGrid.svelte:203-211`, `CardDetail.svelte:140-148`

The card type badge styling (credit=blue, check=emerald, prepaid=violet) is hardcoded in two places with identical logic. Adding a new card type requires edits in both.

**Suggested fix:** Extract a reusable `<CardTypeBadge type={...} />` component or a helper function that returns the correct classes.

---

### Finding 7.2: Empty state pattern is consistent but duplicated
**Confidence: Low** | **Files:** `SpendingSummary.svelte:179-192`, `SavingsComparison.svelte:315-328`, `OptimalCardMap.svelte:170-183`, `CategoryBreakdown.svelte:278-291`

Each component implements its own empty state with the same structure: icon + title + subtitle + CTA button. This is ~15 lines duplicated 4+ times.

**Suggested fix:** Extract an `<EmptyState icon="..." title="..." description="..." />` component.

---

## 8. Typography

### Finding 8.1: No explicit typography scale
**Confidence: Medium** | **File:** `app.css`

The app uses Tailwind's default font-size scale (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-5xl`) without a project-specific typography scale. This works but lacks intentional hierarchy definition.

**Suggested fix:** Document or enforce a typographic scale:
  - `text-xs` (12px): captions, badges, metadata
  - `text-sm` (14px): body secondary, table data
  - `text-base` (16px): body primary
  - `text-lg` (18px): component headings
  - `text-xl` (20px): section headings
  - `text-2xl` (24px): page subheadings
  - `text-3xl` (30px): page headings
  - `text-5xl` (48px): hero (landing page only)

---

### Finding 8.2: font-mono used for financial amounts inconsistently
**Confidence: Low** | **Files:** Multiple

`font-mono` is used for amounts in some places (`SavingsComparison.svelte:168`, `OptimalCardMap.svelte:133`) but not others (`SpendingSummary.svelte:80`, `ReportContent.svelte`). Tabular figures (`font-variant-numeric: tabular-nums`) would be more appropriate than full monospace for aligned number columns.

**Suggested fix:** Create a utility class `.tabular-figures { font-variant-numeric: tabular-nums; }` and apply it to all monetary values in tables and comparison views, removing `font-mono` from amount displays.

---

## 9. Previously Reported Findings (from prior cycles)

### Finding 9.1: U-DES-02 — Error messages not user-friendly
**Status: OPEN** | From prior designer reviews

Parser error messages still mix technical and user-friendly Korean. The cycle 20 review noted this remains open.

---

### Finding 9.2: U-DES-03 — No loading state during analysis
**Status: PARTIALLY RESOLVED**

The current `FileDropzone.svelte` has a comprehensive step indicator and uploading spinner. However, the dashboard page itself does not show a global loading state when reoptimizing — only the "변경 적용" button in `TransactionReview.svelte` shows `reoptimizing` state.

---

### Finding 9.3: U-DES-04 — Results display lacks transaction detail
**Status: RESOLVED**

`TransactionReview.svelte` now provides full transaction-level detail with category editing, search, and confidence badges.

---

## Summary Table

| Priority | Finding | Confidence | File |
|----------|---------|------------|------|
| **High** | 2.1 — KB issuer badge contrast | High | `formatters.ts:150` |
| **High** | 2.2 — Rate bars too thin | High | `OptimalCardMap.svelte:125` |
| **High** | 2.5 — Hover tooltip not touch-friendly | High | `CategoryBreakdown.svelte:201` |
| **High** | 3.1 — Tables on mobile | High | Multiple |
| **High** | 1.1 — Hardcoded colors bypass tokens | High | Multiple |
| **Medium** | 1.2 — Category colors not tokens | High | `CategoryBreakdown.svelte:8` |
| **Medium** | 2.3 — Step connector 1px lines | Medium | `FileDropzone.svelte:408` |
| **Medium** | 2.4 — Confidence badges 10px | Medium | `TransactionReview.svelte:317` |
| **Medium** | 2.6 — Mobile menu no animation | Medium | `Layout.astro:129` |
| **Medium** | 3.2 — Dashboard vertical rhythm | Medium | `dashboard.astro:51` |
| **Medium** | 4.1 — Results button hierarchy | Medium | `results.astro:89` |
| **Medium** | 4.2 — Error states minimal | Medium | `CardGrid.svelte:175` |
| **Medium** | 4.3 — Skeleton colors | Medium | Multiple |
| **Medium** | 5.3 — CardDetail skeleton | Medium | `CardDetail.svelte:108` |
| **Medium** | 5.4 — VisibilityToggle DOM manipulation | Medium | `VisibilityToggle.svelte` |
| **Medium** | 6.2 — Dashboard animation replay | Medium | `dashboard.astro:54` |
| **Medium** | 7.1 — Card type badge duplication | Medium | `CardGrid.svelte:203` |
| **Medium** | 8.1 — No typography scale | Medium | `app.css` |
| **Low** | 1.3 — Shadow inconsistency | Medium | Multiple |
| **Low** | 2.7 — Hamburger no X animation | Low | `Layout.astro:117` |
| **Low** | 2.8 — Theme toggle layout shift | Low | `Layout.astro:88` |
| **Low** | 3.3 — Category labels truncate | Medium | `CategoryBreakdown.svelte:228` |
| **Low** | 4.4 — Hero negative margin | Low | `index.astro:11` |
| **Low** | 5.1 — Feature card inline SVGs | Low | `index.astro:91` |
| **Low** | 5.2 — Print styles duplicated | Low | `app.css`, `report.astro` |
| **Low** | 6.1 — Bouncing checkmark | Low | `FileDropzone.svelte:448` |
| **Low** | 7.2 — Empty state duplication | Low | Multiple |
| **Low** | 8.2 — font-mono inconsistency | Low | Multiple |

---

## Verdict

**FIX BEFORE SHIP** — The high-priority findings (issuer contrast, rate bar height, mobile table layouts, touch interaction) are genuine accessibility and UX issues that affect real users. The medium-priority token-system gaps create maintenance burden and will compound over time. The low-priority items are polish that would elevate the product to production-grade.
