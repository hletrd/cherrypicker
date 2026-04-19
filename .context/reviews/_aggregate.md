# Review Aggregate — 2026-04-19 (Cycle 29)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle29-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-28 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-27 findings have been verified as fixed or deferred. Cycle 28 findings C28-01 through C28-04 are CONFIRMED FIXED. Cycle 29 findings C29-01 through C29-04 are NEW and require implementation.

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

---

## Verification of Cycle 28 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C28-01 | FIXED | `SpendingSummary.svelte:50-62` — "최근 월 지출" shows `optimization.totalSpending`, "전체" sub-label when multi-month |
| C28-02 | FIXED | `FileDropzone.svelte:206` — `Math.round(Number(v))` instead of `Number(v)` |
| C28-03 | FIXED | `xlsx.ts parseDateToISO` — MM/DD format handler added with inferYear + month/day validation |
| C28-04 | FIXED | `SavingsComparison.svelte:74-85` — Defensive comment explaining Infinity sentinel is unreachable but kept as guard |

---

## Active Findings (New in Cycle 29)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C29-01 | MEDIUM | High | `apps/web/src/lib/analyzer.ts:189-192` | performanceExclusions only checks `tx.category`, missing subcategory and dot-notation key matches | OPEN |
| C29-02 | LOW | High | `apps/web/src/pages/results.astro:51` | "총 지출" shows optimization spending without latest-month qualifier — inconsistent with dashboard C28-01 fix | OPEN |
| C29-03 | LOW | High | `apps/web/src/lib/parser/csv.ts:58-64` | MM/DD short-date handler missing month/day range validation that xlsx.ts has | OPEN |
| C29-04 | LOW | Medium | `apps/web/src/lib/parser/pdf.ts:163-169` | Korean short-date handler missing month/day range validation — same class as C29-03 | OPEN |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
