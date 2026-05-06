# Cycle 26 — Debugger Findings

**Date:** 2026-05-06
**Scope:** Latent bug surface, failure modes, edge cases
**Method:** Causal tracing of suspicious flows, competing hypotheses

---

## C26-DEBUG01 — JSON parser negative amount inconsistency traced to optimizer filter (MEDIUM)

**File:** `packages/parser/src/json/index.ts:115` → `packages/core/src/optimizer/greedy.ts:199`
**Confidence:** High

**Hypothesis A:** JSON parser intentionally preserves negatives for user visibility.
**Hypothesis B:** JSON parser accidentally missed the `<= 0` check during implementation.

Evidence: The JSON parser comment at lines 113-114 explicitly states "Negative amounts (refunds/credits) are preserved — the optimizer's positive-only filter handles them." This supports Hypothesis A. But ALL other parsers (CSV, HTML, XLSX, OFX) skip negatives at parse time. The web-side `store.svelte.ts` doesn't filter negatives from `transactions` — it displays whatever the parser returns. So JSON uploaders see refunds in the transaction review UI while CSV uploaders don't.

The optimizer at `greedy.ts:199` filters with `tx.amount > 0 && Number.isFinite(tx.amount)`, which silently excludes negatives. So the inconsistency is purely UI-level: JSON users see refunds that don't contribute to optimization.

**Resolution:** Hypothesis A is confirmed by the comment, but the design is inconsistent. The fix should either (a) make JSON consistent with other parsers, or (b) add explicit negative-amount display handling to the UI so all formats show refunds consistently.

---

## C26-DEBUG02 — Reward calculator branch redundancy creates unreachable code path (MEDIUM)

**File:** `packages/core/src/calculator/reward.ts:260-272`
**Confidence:** High

**Hypothesis A:** The first branch was meant to combine rate + fixed rewards.
**Hypothesis B:** The first branch was meant to prefer rate over fixed.
**Hypothesis C:** The first branch is a copy-paste error.

Evidence: The comment says "rate-based reward takes precedence." But the code doesn't give precedence — it executes the exact same calculation. If Hypothesis A were true, the branch would calculate both and add them. If Hypothesis B were true, the branch would still only calculate the rate (which is what happens). But then the `else if` branch handles the same case (rate only).

The guard `normalizedRate !== null && normalizedRate > 0 && hasFixedReward` is strictly more specific than `normalizedRate !== null && normalizedRate > 0`. So the first branch IS reachable (when both rate and fixed are present), but it does the same thing as the second branch.

**Resolution:** Hypothesis B is closest to the comment intent, but the implementation is incomplete. The branch should either be removed (making fixed+rate fall through to the fixed-only branch, which also seems wrong) or properly implement combined calculation.

---

## C26-DEBUG03 — Analyzer unsafe assertion could crash on edge-case data (LOW)

**File:** `apps/web/src/lib/analyzer.ts:367-368`
**Confidence:** Medium

**Scenario:** A user uploads transactions where all dates are malformed (e.g., "2026-" or "소계"). The `monthlySpending` map is populated with keys from `tx.date.slice(0, 7)`, but the guard at line 337 only checks `tx.date.length >= 7`. If a date is exactly 7 chars like "2026-01" (not 10 chars for full ISO), it's added to `monthlySpending`. The `months` array is built from `monthlySpending.keys()`. `previousMonth` is derived from `months`. So `monthlySpending.get(previousMonth)` should always succeed.

But if a future refactor changes the key derivation logic or adds filtering, the `!` assertion could fail.

**Resolution:** The crash is unlikely in current code, but the `!` is a latent risk. Replace with `?? 0` for safety.

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| MEDIUM | 2 | logic bug, inconsistency |
| LOW | 1 | latent crash |

**Verdict:** FIX AND SHIP
