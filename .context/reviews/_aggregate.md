# Review Aggregate — 2026-04-19 (Cycle 27)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle27-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-26 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-25 findings have been verified as fixed or deferred. Cycle 26 findings C26-01, C26-02, C26-03 are now CONFIRMED FIXED. C26-04 and C26-05 remain deferred.

C27-01 is a new finding (savingsPct division by zero in SavingsComparison). Not previously reported.

C27-02 is a new finding (annual projection from single month). Not previously reported.

C27-03 is a new finding (AI categorization clears subcategory). Not previously reported.

C27-04 is a new finding (file duplicate detection by name only). Not previously reported.

C27-05 is a new finding (RegExp.test() fragility in bank detection). Not previously reported.

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

---

## Verification of Cycle 26 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C26-01 | FIXED | `reward.ts:214-328` — `rewardTypeAccum` map tracks cumulative reward per rewardType, dominant type selected at lines 344-362 |
| C26-02 | FIXED | `CategoryBreakdown.svelte:56-61` — `getCategoryColor()` tries full key, then leaf ID, then uncategorized fallback |
| C26-03 | FIXED | `store.svelte.ts:358-384` — `reoptimize` computes fresh `updatedMonthlyBreakdown` from `editedTransactions` before computing `previousMonthSpending` |
| C26-04 | DEFERRED | `inferYear`/`parseDateToISO` duplication — refactoring effort deferred |
| C26-05 | DEFERRED | 전월실적 display mismatch — UX clarification deferred |

---

## Active Findings (New in Cycle 27, Deduplicated)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C27-01 | MEDIUM | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:73-76` | `savingsPct` division by zero when `bestSingleCard.totalReward` is 0 — Infinity mapped to 0 hides legitimate improvement | OPEN |
| C27-02 | LOW | Medium | `apps/web/src/components/dashboard/SavingsComparison.svelte:189` | Annual projection multiplies single-month savings by 12 without clarification | OPEN |
| C27-03 | LOW | High | `apps/web/src/components/dashboard/TransactionReview.svelte:114` | AI categorization clears subcategory, losing specificity that could affect reward matching | OPEN |
| C27-04 | LOW | High | `apps/web/src/components/upload/FileDropzone.svelte:129` | Duplicate file detection by name only — silently drops same-named different files | OPEN |
| C27-05 | LOW | Medium | `packages/parser/src/detect.ts:116`, `apps/web/src/lib/parser/detect.ts:134` | `RegExp.test()` in loop is safe now but fragile — adding `/g` flag to patterns would break bank detection | OPEN |

---

## Prioritized Action Items

1. **C27-01**: Add special case for zero `bestSingleCard.totalReward` with positive `savingsVsSingleCard` — show "최적" badge instead of computing percentage
2. **C27-02**: Add clarifying note to annual projection text that it is based on the latest month (deferred — UX polish)
3. **C27-03**: Preserve subcategory after AI categorization when category is unchanged, or re-run matcher (deferred — AI integration complexity)
4. **C27-04**: Add warning when file is skipped due to name collision (deferred — minor UX)
5. **C27-05**: Document or guard against `/g` flag in BANK_SIGNATURES patterns (deferred — latent risk, not currently triggered)

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
