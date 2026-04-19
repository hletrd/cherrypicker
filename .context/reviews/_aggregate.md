# Review Aggregate -- 2026-04-19 (Cycle 43)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle43-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-42 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C43-L01 is a refinement of the existing warning at `reward.ts:265-269` (both rate and fixedAmount). Not previously tracked as a separate finding.
C43-L02/C43-L03 are new findings about `formatWon`/`formatRate` NaN guards in the report generator. Not previously reported.
C43-L04 is same class as C42-L02 (silent error swallowing). Not a duplicate but similar pattern.

---

## Verification of Cycle 42 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C42-L01 | **STILL DEFERRED** | Web-side PDF `tryStructuredParse` bare `catch {}` still at `apps/web/src/lib/parser/pdf.ts:284` |
| C42-L02 | **STILL DEFERRED** | Server-side CSV `parseCSV` silent error swallowing still at `packages/parser/src/csv/index.ts:56-65` |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:206` uses `Math.round(Number(v))` with guards |
| D-102 | **RESOLVED** | `packages/core/src/index.ts:18` now exports `buildCategoryKey` |

---

## Active Findings (New in Cycle 43)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C43-L01 | LOW | Medium | `packages/core/src/calculator/reward.ts:259-273` | When both rate and fixedAmount are present, perTxCap applied to rate-based reward may be miscalibrated -- no current YAML files trigger this | DEFERRED (theoretical) |
| C43-L02 | LOW | High | `packages/viz/src/report/generator.ts:9-11` | Server-side `formatWon` lacks `Number.isFinite` guard | NEW -- trivial fix |
| C43-L03 | LOW | High | `packages/viz/src/report/generator.ts:13-15` | Server-side `formatRate` lacks `Number.isFinite` guard | NEW -- trivial fix |
| C43-L04 | LOW | High | `apps/web/src/lib/parser/index.ts:34` | Web-side encoding detection silently swallows errors | DEFERRED (same class as C42-L02) |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
