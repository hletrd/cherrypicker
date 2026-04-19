# Plan 05 — Medium-Priority Fixes (Cycle 2: C2-04, C2-U05, C2-U03, C2-D06)

**Priority:** MEDIUM
**Findings addressed:** C2-04, C2-U05, C2-U03, C2-D06
**Status:** Completed

---

## Task 1: Fix timezone issue in `formatDateKo` and `formatDateShort` (C2-04)

**Finding:** `apps/web/src/lib/formatters.ts:137-151` — `new Date("YYYY-MM-DD")` is parsed as UTC midnight, but `getMonth()`/`getDate()` return local time values. In timezones behind UTC, the date could display as the previous day.

**File:** `apps/web/src/lib/formatters.ts`

**Implementation:**
1. Replace `new Date(dateStr)` with a manual parse to avoid UTC/local mismatch:
```ts
export function formatDateKo(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '-';
  const [y, m, d] = parts;
  return `${y}년 ${parseInt(m!, 10)}월 ${parseInt(d!, 10)}일`;
}

export function formatDateShort(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '-';
  const [, m, d] = parts;
  return `${parseInt(m!, 10)}/${parseInt(d!, 10)}`;
}
```

**Commit:** `fix(web): 🕐 use manual date parsing to avoid UTC/local timezone mismatch`

---

## Task 2: Add focus trap for mobile menu (C2-U05)

**Finding:** `apps/web/src/layouts/Layout.astro:129-156` — When the mobile menu is open, keyboard users can tab out of the menu to elements behind it, violating WCAG 2.2 focus management requirements.

**File:** `apps/web/public/scripts/layout.js`

**Implementation:**
1. When the mobile menu opens, trap focus within it:
   - Move focus to the first link
   - On Tab at the last element, wrap to the first
   - On Shift+Tab at the first element, wrap to the last
2. When the menu closes, return focus to the toggle button
3. Close the menu on Escape key press

**Commit:** `fix(web): ♿ add focus trap and Escape key support for mobile menu`

---

## Task 3: Fix mobile menu `inert` attribute handling (C2-U03)

**Finding:** `apps/web/src/layouts/Layout.astro:133` — The mobile menu has `inert` in the initial HTML. If JS fails to load, the menu is permanently inaccessible. The `inert` attribute should be added/removed dynamically by JS.

**File:** `apps/web/src/layouts/Layout.astro`, `apps/web/public/scripts/layout.js`

**Implementation:**
1. Remove `inert` from the initial HTML of the mobile menu div
2. Add `inert` via JS on page load (menu starts hidden)
3. Toggle `inert` when the menu opens/closes

**Commit:** `fix(web): ♿ make mobile menu inert attribute dynamic instead of static`

---

## Task 4: Compute per-card `previousMonthSpending` based on individual exclusions (C2-D06)

**Finding:** `apps/web/src/lib/analyzer.ts:159-161` — All cards get the same `previousMonthSpending` value, but different cards have different `performanceExclusions`. Cards with more exclusions should have a lower qualifying spending.

**File:** `apps/web/src/lib/analyzer.ts`

**Implementation:**
1. Replace the single `previousMonthSpending` with per-card computation:
```ts
const cardPreviousSpending = new Map<string, number>();
for (const rule of cardRules) {
  if (options?.previousMonthSpending !== undefined) {
    // User provided a value — use it for all cards
    cardPreviousSpending.set(rule.card.id, options.previousMonthSpending);
  } else {
    // Compute per-card qualifying spending based on each card's own exclusions
    const exclusions = new Set(rule.performanceExclusions);
    const qualifying = transactions
      .filter(tx => !exclusions.has(tx.category))
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    cardPreviousSpending.set(rule.card.id, qualifying);
  }
}
```
2. Remove the old `allExclusions` union and single `previousMonthSpending` computation

**Commit:** `fix(core): 🧮 compute per-card previousMonthSpending based on individual exclusions`

---

## Progress

- [x] Task 1: Fix timezone issue in formatDateKo/formatDateShort — `000000029cc`
- [x] Task 2: Add focus trap for mobile menu — `0000000e1f4`
- [x] Task 3: Fix mobile menu inert attribute handling — `0000000e1f4` (combined with Task 2)
- [x] Task 4: Compute per-card previousMonthSpending — `0000000a8ee`
