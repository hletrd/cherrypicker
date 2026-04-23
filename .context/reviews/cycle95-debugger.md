# Cycle 95 — debugger

## Latent Bug Surface Examined

- **`SavingsComparison.svelte` animation effect** (lines 51-89):
  - Early-return at line 53 when `target === 0 && displayedSavings === 0` — correct no-op guard.
  - Line 54 `target === lastTargetSavings` prevents redundant re-animation on HMR/reactivity storms.
  - `lastTargetSavings` / `lastTargetAnnual` kept as plain `let` (not $state) — matches C83-02 pattern; no reactive leakage.
  - Cleanup cancels in-flight RAF. `cancelled` flag prevents late-scheduled tick from writing state after unmount.

- **`store.svelte.ts` reoptimize** (lines 486-593):
  - Early null-guard (C45-01) prevents `TypeError: Cannot read properties of null`.
  - Snapshot captured post-guard (C81-01) — async gaps preserve consistent view.
  - `previousMonthSpending` resolution order: caller > original-user-input > computed — matches C44-01 intent.
  - monthlyBreakdown rebuilt from edited transactions, not from pre-edit baseline.

- **`store.svelte.ts` loadFromStorage** (lines 222-330):
  - `_v ?? 0` treats legacy unversioned data as version 0 (C76-01).
  - Migrations run before validation.
  - Invalid `cardResults` entries stripped rather than discarding whole blob.
  - `persistWarningKind = 'corrupted'` when `transactions` array existed but all entries failed validation.

- **`TransactionReview.svelte` sync effect** (lines 123-139):
  - Atomic read of `analysisStore.result` snapshot prevents mid-effect store mutation.
  - `editedTxs = []` on empty store result (C61-01) — avoids stale-data carryover after reset.

- **`SpendingSummary.svelte` month diff** (lines 139-147):
  - Regex-validated month strings (`/^\d{4}-\d{2}$/`) guard parseInt NaN.
  - Combined `Number.isFinite` check across y1/y2/m1/m2 before computing diff.
  - Label falls back to "이전 실적" when diff is invalid/0.

## Race / Ordering Checks

- `reoptimize` + concurrent `analyze` — both await but `reoptimize` snapshots pre-await. The latter caller's result survives via the snapshot path.
- `cards.ts` `loadCardsData` retries on undefined AbortError result (per prior notes).

## Found Issues

None new. All prior debugger findings (D-29, D-30, D-31 in deferred items) remain appropriately-scoped.

## Summary

0 new findings. Ordering, race, and null-guard patterns remain correct.
