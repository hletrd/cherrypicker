# Cycle 16 Comprehensive Code Review — 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/optimizer/greedy.ts`, and cross-file interaction analysis. Re-verification of all prior cycle findings.

---

## New Findings

### C16-01 [MEDIUM] Confidence: High — isValidTx drops negative-amount (refund) transactions on sessionStorage restore

**File:** `apps/web/src/lib/store.svelte.ts:139-151`

**Description:** The `isValidTx` validation function requires `tx.amount > 0` (line 148). This means any transaction with a negative amount (refunds, cancellations) will fail validation and be silently dropped when restoring from sessionStorage. This is a **data-loss bug** that extends C9R-03 (PDF negative amounts silently dropped). Even if the PDF parser were fixed to pass negative amounts through, they would still be lost on page reload because the sessionStorage restore path would reject them.

```typescript
function isValidTx(tx: any): tx is CategorizedTx {
  return (
    tx &&
    typeof tx === 'object' &&
    // ...
    tx.amount > 0 &&  // <-- rejects negative amounts (refunds)
    // ...
  );
}
```

**Concrete failure scenario:**
1. User uploads a PDF containing a refund transaction with amount -50,000
2. If C9R-03 is fixed and the refund passes through the parser, it appears in the transaction list
3. The transaction is persisted to sessionStorage with `amount: -50000`
4. User closes and reopens the tab
5. `loadFromStorage()` calls `isValidTx()` which rejects the negative amount
6. The refund transaction is silently dropped — data loss

**Fix:** Change `tx.amount > 0` to `tx.amount !== 0` (or `Math.abs(tx.amount) > 0`), and ensure `Number.isFinite` already guards against NaN/Infinity. This preserves the "drop zero-amount rows" behavior while allowing legitimate negative amounts.

---

### C16-02 [LOW] Confidence: High — CSV generic parser uses English error messages while bank adapters use Korean

**File:** `apps/web/src/lib/parser/csv.ts:246`

**Description:** The generic CSV parser pushes English error messages:
```typescript
errors.push({ line: i + 1, message: `Cannot parse amount: ${amountRaw}`, raw: line });
```

But all bank-specific adapters (Samsung, Shinhan, KB, etc.) use Korean messages via the shared `isValidAmount` helper:
```typescript
errors.push({ line: lineIdx + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}` });
```

This inconsistency means that when the generic fallback parser is used (e.g., for unsupported banks), users see English error messages while bank-specific parsing shows Korean. For a Korean-language application, this is jarring.

**Fix:** Change the generic parser's error message to Korean: `금액을 해석할 수 없습니다: ${amountRaw}` (matching the `isValidAmount` helper's message).

---

### C16-03 [LOW] Confidence: Medium — SpendingSummary "전월실적" label misleading for multi-month gaps

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:138`

**Description:** When the user uploads months that are more than 1 month apart (e.g., January and April with February/March missing), the label calculation shows:
```
{@const monthDiff = ... ? (y1 - y2) * 12 + (m1 - m2) : NaN}
{@const prevLabel = monthDiff === 1 ? '전월실적' : '이전 달 실적'}
```

For a 3-month gap, "이전 달 실적" (previous month's performance) is misleading because it implies the previous month rather than the actual 3-month gap. A more accurate label would be "3개월 전 실적" or "이전 실적 (3개월 차이)".

**Concrete scenario:**
1. User uploads January 2026 and April 2026 statements
2. The label says "이전 달 실적" for the January data
3. User expects this to be last month's data, but it's actually 3 months prior

**Fix:** Change the label to reflect the actual gap: `monthDiff === 1 ? '전월실적' : \`${monthDiff}개월 전 실적\``

---

### C16-04 [LOW] Confidence: High — CardGrid fetches cards without AbortController on unmount

**File:** `apps/web/src/components/cards/CardGrid.svelte:73-78`

**Description:** The CardGrid component fetches cards in `onMount` without an AbortController:
```typescript
onMount(() => {
  getCards()
    .then((result) => { cards = result; })
    .catch((e) => { error = e instanceof Error ? e.message : '카드를 불러오지 못했어요'; })
    .finally(() => { loading = false; });
});
```

Unlike CardDetail.svelte and CardPage.svelte which use AbortController + generation counter patterns, CardGrid doesn't cancel the fetch on unmount. While `loadCardsData()` caches the promise internally (so no duplicate network requests), the `.then()` callback will still execute after unmount, setting state on a detached component.

**Fix:** Add AbortController cleanup matching the pattern used in CardDetail.svelte and CardPage.svelte:
```typescript
onMount(() => {
  const controller = new AbortController();
  getCardList(undefined, { signal: controller.signal })
    .then((result) => { if (!controller.signal.aborted) cards = result; })
    .catch((e) => { if (!controller.signal.aborted) error = ...; })
    .finally(() => { if (!controller.signal.aborted) loading = false; });
  return () => { controller.abort(); };
});
```

Note: `getCardList` would also need to accept and pass through the `signal` parameter (currently it doesn't). Alternatively, since the data is cached and shared, the risk is minimal — this is a code quality/consistency fix rather than a correctness bug.

---

## Verification of Prior Cycle Findings

All prior cycle 1-15 findings are confirmed fixed except as noted in the current `_aggregate.md`. The following open findings were re-verified and remain unchanged:

| Finding | Status | Notes |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile — no change |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month — no change |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web — no change |
| C7-10 | OPEN (LOW) | CategoryBreakdown percentage rounding can cause total > 100% — no change |
| C7-11 | OPEN (LOW) | persistWarning message misleading — no change |
| C8-01 | OPEN (MEDIUM) | AI categorizer disabled but dead code — no change |
| C8-05/C4-09 | OPEN (LOW) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast — no change |
| C8-06/C7-12 | OPEN (LOW) | CardDetail + FileDropzone use full page reload — no change |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift — no change |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 — no change |
| C8-09 | OPEN (LOW) | Test duplicates production code — no change |
| C8-10 | OPEN (LOW) | csv.ts installment NaN implicitly filtered — no change |
| C8-11 | OPEN (LOW) | pdf.ts fallback date regex could match decimals — no change |
| C9R-03 | OPEN (LOW) | pdf.ts negative amounts (refunds) silently dropped — **now extended by C16-01** (same data is also lost on sessionStorage restore) |
| C15-01 | OPEN (LOW) | `undefined as unknown as` type escape in cards.ts — no change |

---

## Final Sweep — Commonly Missed Issues

1. **No unguarded `any` casts in new code** — `store.svelte.ts` uses `any` in `isValidTx` and `loadFromStorage`, but these are validated at runtime. Acceptable for runtime type guards.
2. **No new `console.log` calls** — Only `console.warn` for legitimate adapter failures and build-time warnings.
3. **No new `eslint-disable` or `@ts-ignore`** — Only one pre-existing `eslint-disable` in the test file for type assertions.
4. **No secrets or credentials** — Confirmed no API keys, tokens, or passwords in source files.
5. **CSP is properly restrictive** — `connect-src 'self'` prevents data exfiltration; `worker-src 'self' blob:` is needed for PDF.js.
6. **No prototype pollution vectors** — `JSON.parse` results are validated before use.
7. **No XSS vectors** — All dynamic content is rendered via Svelte's auto-escaping `{}` syntax; no `@html` directives found.
