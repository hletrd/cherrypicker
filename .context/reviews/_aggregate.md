# Review Aggregate — 2026-04-19 (Cycle 7)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle7-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- `.context/reviews/_aggregate.md` (cycle 6)
- All cycle 1-6 per-agent files

---

## Deduplication with Prior Reviews

All cycle 1-5 findings have been verified as fixed or deferred. Cycle 6 findings C6-01 through C6-11 are now fixed. They are not re-listed here.

Deferred items D-01 through D-55 and LOW items from cycle 6 remain unchanged and are not re-listed here.

---

## Verification of Cycle 6 Fixes

All 5 implemented cycle 6 fixes verified as correctly implemented:
- C6-07: AI categorizer subcategory clearing
- C6-01: Redundant CardBreakdown rate field removed
- C6-02: persistWarning indicator for truncated sessionStorage
- C6-03: Smooth count-up animation on re-render
- C6-11: formatRatePrecise helper added

---

## Active Findings (New in Cycle 7, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C7-01 | MEDIUM | High | `SavingsComparison.svelte:223` | Breakdown table uses inline rate formatting instead of `formatRate()` | Extends C6-11 |
| C7-02 | MEDIUM | High | `SpendingSummary.svelte:94` | Effective rate uses inline formatting instead of `formatRatePrecise()` | Extends C6-11 |
| C7-03 | LOW | High | `SavingsComparison.svelte:149` | Best single card rate uses inline formatting instead of `formatRatePrecise()` | Extends C6-11 |
| C7-04 | MEDIUM | Medium | `TransactionReview.svelte:125-132` | `$effect` re-sync overwrites `editedTxs` on any generation change — fragile | New |
| C7-05 | LOW | High | `store.svelte.ts:102` | `_persistWarning` module-level mutable creates fragile coupling | New |
| C7-06 | LOW | High | `analyzer.ts:264-294` | All-month transactions in reoptimize but only latest month optimized — mismatch | New |
| C7-07 | LOW | High | `detect.ts` (both copies) | `BANK_SIGNATURES` duplicated across packages/parser and apps/web | Extends D-01 |
| C7-08 | MEDIUM | High | `pdf.ts:126-143` | Browser PDF `parseDateToISO` missing Korean short-date and MM/DD handling | New |
| C7-09 | LOW | High | `formatters.ts:151,162` | `formatDateKo`/`formatDateShort` use `parseInt` without NaN guard | New |
| C7-10 | LOW | High | `CategoryBreakdown.svelte:78,94-95` | Percentage rounding can cause total > 100% | New |
| C7-11 | MEDIUM | Medium | `store.svelte.ts:215` | `persistWarning` message misleading for data corruption vs size truncation | Extends C6-02 |
| C7-12 | LOW | High | `CardDetail.svelte:252` | Uses `window.location.href` for navigation instead of client-side router | Extends D-45 |
| C7-13 | LOW | Medium | `analyzer.ts:191-194` | `toCoreCardRuleSets` cache never hits — reference equality on always-new array | New |

---

## Cross-Agent Agreement (Cycle 7)

| Finding | Signal |
|---|---|
| C7-01 / C7-02 / C7-03 / C6-11 | Inline rate formatting inconsistency — 4 locations across 2 components. C6-11 fixed one location but missed the other 3. Strong signal that all inline rate formatting should use helpers. |
| C7-11 / C6-02 | persistWarning UX — C6-02 added the indicator but the message doesn't differentiate truncation from corruption. Combined signal is MEDIUM. |
| C7-07 / D-01 | Duplicated code across packages/parser and apps/web — 2 findings across cycles. Signal remains LOW but the divergence risk increases. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C7-08: Add `inferYear` and short-date handling to PDF parser's `parseDateToISO` (real bug — missing date formats)
2. C7-02: Replace inline rate formatting in SpendingSummary with `formatRatePrecise`
3. C7-01: Replace inline rate formatting in SavingsComparison breakdown table with `formatRate`
4. C7-03: Replace inline rate formatting in SavingsComparison best single card with `formatRatePrecise`

### MEDIUM (plan for next cycles)
5. C7-11: Differentiate persistWarning between truncation and corruption
6. C7-04: Guard TransactionReview effect against unnecessary re-syncs
7. C7-06: Filter editedTxs to latest month in reoptimize or document the behavior

### LOW (defer or accept)
- C7-05, C7-07, C7-09, C7-10, C7-12, C7-13

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
