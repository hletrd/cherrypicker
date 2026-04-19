# Review Aggregate -- 2026-04-19 (Cycle 46)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle46-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-45 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C46-L01 is a new finding about `viz/report/generator.ts` local `formatWon` not normalizing negative zero. Not previously reported (the web-side `formatWon` was fixed in C45-L01, but the report generator has its own separate `formatWon`).

C46-L02 is a new angle on the D-107 deferred finding: the server-side CSV parser silently swallows adapter errors while the web-side logs warnings. The fix (add `console.warn`) is less invasive than the full restructuring implied by D-107.

---

## Verification of Cycle 45 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C45-L01 | **FIXED** | `apps/web/src/lib/formatters.ts:8` normalizes negative zero. `SavingsComparison.svelte:202` has `Object.is(displayedSavings, -0)` guard. |
| C45-L02 | **FIXED** | `SpendingSummary.svelte:119` checks consecutive months and switches label. |
| C45-L03 | **STILL PRESENT** | CategoryBreakdown hardcoded color map (carry-over from D-42). |
| C45-L04 | **FIXED** | `OptimalCardMap.svelte:23` uses `0.0001` minimum. |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with guard |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | **STILL DEFERRED** | `packages/parser/src/csv/index.ts:60-63` silent `catch { continue; }` |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## Active Findings (New in Cycle 46)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C46-L01 | LOW | Medium | `packages/viz/src/report/generator.ts:9-12` | Local `formatWon` does not normalize negative zero | NEW -- cosmetic edge case |
| C46-L02 | LOW | High | `packages/parser/src/csv/index.ts:60-63` | Server-side CSV adapter fallback silently swallows errors; web-side logs warnings | NEW -- observability |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
