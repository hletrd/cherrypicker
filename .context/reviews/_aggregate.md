# Review Aggregate — 2026-04-19 (Cycle 30)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle30-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-29 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-29 findings have been verified as fixed or deferred. Cycle 29 findings C29-01 through C29-04 are CONFIRMED FIXED. Cycle 30 findings C30-01 and C30-02 are NEW and require implementation.

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

---

## Verification of Cycle 29 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C29-01 | FIXED | `analyzer.ts:194-200` — performanceExclusions checks tx.category, tx.subcategory, and dot-notation key |
| C29-02 | FIXED | `results.astro:50` — "최근 월 지출" label |
| C29-03 | FIXED | `csv.ts:64` — month/day range validation for MM/DD |
| C29-04 | FIXED | `pdf.ts:167` and `xlsx.ts:232` — range validation for Korean short dates |

---

## Active Findings (New in Cycle 30)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C30-01 | MEDIUM | High | `apps/web/public/scripts/results.js:14` | Unconditional "+" on savings produces "+-50,000원" for negative savingsVsSingleCard; inconsistent with SavingsComparison.svelte | OPEN |
| C30-02 | LOW | Medium | `csv.ts:71-72`, `pdf.ts:159-160`, `xlsx.ts:224-225` | Korean full-date format lacks month/day range validation — "2026년 99월 99일" produces invalid date | OPEN |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
