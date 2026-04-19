# Plan 33 — Medium/Low-Priority Fixes (Cycle 19)

**Priority:** MEDIUM/LOW
**Findings addressed:** C19-03, C19-04
**Status:** TODO

---

## Task 1: Derive availableIssuers from filtered cards (C19-03)

**Finding:** C19-03 — `CardGrid.svelte:22` derives `availableIssuers` from the full `cards` list instead of `filteredCards`. When a type filter (e.g., "체크카드") is active, issuers with 0 matching cards still appear. Clicking such an issuer shows "검색 결과가 없어요".

**File:** `apps/web/src/components/cards/CardGrid.svelte:22`

**Implementation:**

```ts
let availableIssuers = $derived([...new Set(filteredCards.map(c => c.issuer))].sort());
```

Note: `availableIssuers` is used in the template before `filteredCards` is derived. We need to ensure the derivation order is correct. In Svelte 5, `$derived` is lazy, so this should work — `availableIssuers` will be derived after `filteredCards` since it depends on it.

However, we also need to handle the case where the current `issuerFilter` value is no longer in the available issuers after type filter change. If the user selected an issuer, then changed the type filter, the issuer may have 0 cards. We should reset `issuerFilter` when it's no longer valid:

```ts
// Reset issuer filter if the selected issuer has no cards in the filtered set
$effect(() => {
  if (issuerFilter && !availableIssuers.includes(issuerFilter)) {
    issuerFilter = '';
  }
});
```

**Commit:** `fix(web): 🐛 derive availableIssuers from filtered cards so issuers with 0 matching cards are hidden`

---

## Task 2: Use date.slice for period formatting robustness (C19-04)

**Finding:** C19-04 — `formatPeriod` in `SpendingSummary.svelte` uses `split('-')` which is fragile. ISO 8601 dates are always `YYYY-MM-DD`, so `slice(0, 7)` is more robust.

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:16-25`

**Implementation:**

```ts
function formatPeriod(period: { start: string; end: string } | undefined): string {
  if (!period) return '-';
  const startYM = period.start.slice(0, 7); // "YYYY-MM"
  const endYM = period.end.slice(0, 7);
  if (startYM.length < 7 || endYM.length < 7) return '-';
  const [sy, sm] = startYM.split('-');
  const [ey, em] = endYM.split('-');
  if (!sy || !sm || !ey || !em) return '-';
  const smNum = parseInt(sm, 10);
  const emNum = parseInt(em, 10);
  if (Number.isNaN(smNum) || Number.isNaN(emNum)) return '-';
  const startStr = `${sy}년 ${smNum}월`;
  const endStr = `${ey}년 ${emNum}월`;
  return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
}
```

**Commit:** `refactor(web): ♻️ use date.slice for period formatting robustness`

---

## Deferred Items from This Cycle

### C19-05 (extends D-38): Dashboard renders both empty state and data content divs

- **Original finding:** C19-05
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/pages/dashboard.astro:31-119`
- **Reason for deferral:** Same as D-38. The fix requires restructuring the dashboard page to conditionally render the data content section. Using `client:visible` would avoid unnecessary hydration but requires testing that Svelte island hydration works correctly with lazy loading. The performance impact is minimal (one extra `loadCategories()` fetch) and the user experience is not affected.
- **Exit criterion:** If the dashboard page has noticeable load time issues or unnecessary network requests, switch to `client:visible` or conditional rendering.

### C19-06 (extends D-62): CardDetail no AbortController cleanup

- **Original finding:** C19-06
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/cards/CardDetail.svelte:55-70`
- **Reason for deferral:** Same as D-62. The `fetchGeneration` counter correctly prevents stale responses. Adding AbortController would be a nice improvement but the network waste is minimal (one fetch per card navigation).
- **Exit criterion:** If CardDetail fetches cause noticeable performance issues, add AbortController cleanup.

---

## Progress

- [x] Task 1: Derive availableIssuers from filtered cards
- [x] Task 2: Use date.slice for period formatting robustness
