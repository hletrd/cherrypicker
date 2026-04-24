# Code Reviewer — Cycle 12

**Date:** 2026-04-24
**Reviewer:** code-reviewer

## Findings

### C12-CR01: `calculateRewards` globalMonthUsed can exceed globalCap after rollback [MEDIUM]
- **File:** `packages/core/src/calculator/reward.ts:311-331`
- **Description:** When the global cap clips a reward, `ruleMonthUsed` is rolled back by `overcount`, but `globalMonthUsed` is advanced by only `appliedReward`. This is correct. However, if a subsequent transaction's reward is NOT clipped by the global cap, `globalMonthUsed += appliedReward` (line 331) uses the full reward amount. But the `ruleMonthUsed` for that same rule may have been rolled back previously, meaning the rule-level tracker thinks more cap is available than the global tracker does. This creates a scenario where two different rules sharing the same global cap can have their rule-level trackers over-report remaining capacity relative to the global constraint. In practice this is unlikely to cause visible bugs because the global cap check (line 312) is applied independently per transaction, but it is a latent inconsistency.
- **Confidence:** Low
- **Severity:** MEDIUM (latent inconsistency in cap tracking)
- **Fix:** After rolling back `ruleMonthUsed`, also adjust `globalMonthUsed` to reflect the actual applied amount rather than advancing it separately. Or, track only the global used amount and derive rule-level remaining from it.

### C12-CR02: `formatSavingsValue` negative prefixValue with positive value shows no sign [LOW]
- **File:** `apps/web/src/lib/formatters.ts:224-227`
- **Description:** When `prefixValue` is negative (e.g., -5000) and `value` is positive (e.g., 5000), the function shows `5,000원` without any sign indicator. The `>= 100` check only adds `+`. This is the same class as C11-CR06 and is documented as intentional (direction communicated by label), but the footgun remains for any future caller that doesn't use a directional label.
- **Confidence:** High
- **Severity:** LOW

### C12-CR03: No `crypto` import guard in `loadCardsData` for non-browser environments [LOW]
- **File:** `apps/web/src/lib/cards.ts:193-241`
- **Description:** `loadCardsData` uses `fetch` which is only available in browser environments. The function is only called from the web app, so this is fine. However, the `chainAbortSignal` helper and `isAbortError` are defensive but the AbortController and AbortSignal APIs are assumed to exist. In extremely old browsers this would fail, but the app already requires modern JS features (Svelte 5, $state runes), so this is acceptable.
- **Confidence:** High
- **Severity:** LOW (informational)

### C12-CR04: XLSX parser `BANK_COLUMN_CONFIGS` duplicates bank header names [LOW]
- **File:** `apps/web/src/lib/parser/xlsx.ts:18-170`
- **Description:** The `BANK_COLUMN_CONFIGS` record maps BankId to header names, duplicating the same header names also present in the CSV adapters (`apps/web/src/lib/parser/csv.ts`). This is the same class of finding as D-01 (duplicate parser implementations). Fully deduplicating requires the D-01 architectural refactor.
- **Confidence:** High
- **Severity:** LOW (same class as D-01, already tracked)

## Convergence Note

All four findings are either LOW severity instances of already-tracked patterns (D-01, C11-CR06) or latent issues with low confidence of real-world impact (C12-CR01). No new HIGH-severity findings. The codebase is well-defended with extensive inline comments documenting edge cases, guard clauses, and cross-reference tags (C-XX-YY patterns).
