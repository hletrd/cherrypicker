# Cycle 16 Implementation Plan

## New Findings to Address

### C16-01 [MEDIUM] — isValidTx drops negative-amount (refund) transactions on sessionStorage restore
- **File:** `apps/web/src/lib/store.svelte.ts:148`
- **Fix:** Change `tx.amount > 0` to `tx.amount !== 0` in `isValidTx()`. The `Number.isFinite(tx.amount)` guard on line 147 already excludes NaN/Infinity. This allows legitimate negative amounts (refunds) to survive sessionStorage restore while still filtering out zero-amount entries.
- **Also related:** C9R-03 (pdf.ts negative amounts dropped at parse). When both are fixed together, refund transactions will flow from parser through to persistence and back.

### C16-02 [LOW] — Generic CSV parser uses English error messages
- **File:** `apps/web/src/lib/parser/csv.ts:246`
- **Fix:** Change `Cannot parse amount: ${amountRaw}` to `금액을 해석할 수 없습니다: ${amountRaw}` to match the Korean messages used by all bank-specific adapters via `isValidAmount`.

### C16-03 [LOW] — SpendingSummary "이전 달 실적" label misleading for multi-month gaps
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:138`
- **Fix:** Change the label from a binary `전월실적` / `이전 달 실적` to include the actual gap:
  ```
  monthDiff === 1 ? '전월실적' : `${monthDiff}개월 전 실적`
  ```

### C16-04 [LOW] — CardGrid fetches cards without AbortController cleanup
- **File:** `apps/web/src/components/cards/CardGrid.svelte:73-78`
- **Fix:** Add AbortController + signal to the onMount fetch, matching CardDetail/CardPage patterns. Also needs `getCardList` to accept and forward a `signal` parameter through to `loadCardsData`.

## Implementation Order

1. **C16-02** — Simple string fix, no logic change
2. **C16-01** — Core data-integrity fix (isValidTx)
3. **C16-03** — Label improvement
4. **C16-04** — Code quality/consistency (AbortController pattern)

## Deferred Items

All prior deferred items from `00-deferred-items.md` remain unchanged. No new deferrals this cycle.
