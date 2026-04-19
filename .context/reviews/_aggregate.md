# Review Aggregate -- 2026-04-19 (Cycle 44)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle44-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-43 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C44-L01 is a new finding about the SavingsComparison count-up animation jumping when `target === 0`. Not previously reported as a separate finding.
C44-L02 is a carry-over from D-107/C42-L02. Same finding, re-confirmed.
C44-L03 is a carry-over from D-106/C42-L01. Same finding, re-confirmed.
C44-L04 is a new observation about non-latest month edits having no visible optimization effect. Not previously reported.

---

## Verification of Cycle 43 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C43-L01 | **STILL DEFERRED** | `packages/core/src/calculator/reward.ts:259-273` -- perTxCap applied to rate-based reward when both rate and fixedAmount present |
| C43-L02 | **FIXED** | `packages/viz/src/report/generator.ts:10` has `if (!Number.isFinite(amount)) return '0원';` |
| C43-L03 | **FIXED** | `packages/viz/src/report/generator.ts:15` has `if (!Number.isFinite(rate)) return '0.00%';` |
| C43-L04 | **STILL DEFERRED** | `apps/web/src/lib/parser/index.ts:34` still uses `catch { continue; }` for encoding detection |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:206` uses `Math.round(Number(v))` with guards |
| D-102 | **RESOLVED** | `packages/core/src/index.ts:18` now exports `buildCategoryKey` |

---

## Active Findings (New in Cycle 44)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C44-L01 | LOW | High | `apps/web/src/components/dashboard/SavingsComparison.svelte:53-69` | Count-up animation jumps to 0 when savings target is exactly 0 instead of smooth transition | NEW -- minor UX fix |
| C44-L02 | LOW | High | `packages/parser/src/csv/index.ts:56-65` | Server-side CSV content-signature detection silently swallows adapter errors | CARRY-OVER (same as D-107) |
| C44-L03 | LOW | High | `apps/web/src/lib/parser/pdf.ts:284` | Web-side PDF `tryStructuredParse` catches all exceptions with bare `catch {}` | CARRY-OVER (same as D-106) |
| C44-L04 | LOW | Medium | `apps/web/src/lib/store.svelte.ts:340-411` | Edits to non-latest month transactions have no visible optimization effect | NEW -- UX design consideration |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
