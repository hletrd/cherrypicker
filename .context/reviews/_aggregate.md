# Review Aggregate -- 2026-04-19 (Cycle 47)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle47-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-46 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C47-L01 and C47-L02 are new findings about terminal `formatWon`/`formatRate` lacking `Number.isFinite` guards and negative-zero normalization. Not previously reported -- the web-side `formatWon` was fixed in C45-L01 and the report-generator `formatWon` in C46-L01, but the terminal versions were not updated.

---

## Verification of Cycle 46 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C46-L01 | **FIXED** | `packages/viz/src/report/generator.ts:12` has `if (amount === 0) amount = 0;` normalization |
| C46-L02 | **FIXED** | `packages/parser/src/csv/index.ts:62` has `console.warn` for adapter failures |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with guard |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | **PARTIALLY ADDRESSED** | Server-side CSV adapter loop now logs warnings (C46-L02 fix), but `catch { continue; }` still doesn't collect errors into ParseResult |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## Active Findings (New in Cycle 47)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C47-L01 | LOW | High | `packages/viz/src/terminal/summary.ts:5-7`, `comparison.ts:4-6` | Terminal `formatWon` lacks `Number.isFinite` guard and negative-zero normalization | NEW -- consistency gap |
| C47-L02 | LOW | High | `packages/viz/src/terminal/summary.ts:9-11`, `comparison.ts:8-10` | Terminal `formatRate` lacks `Number.isFinite` guard | NEW -- consistency gap |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
