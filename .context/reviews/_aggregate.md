# Review Aggregate -- 2026-04-19 (Cycle 50)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle50-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-49 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C50-M01 (viz category labels) is a new finding not reported in any prior cycle. The issue was partially visible in C19-02 (which fixed category label resolution in the web dashboard) but the viz package was never updated to use the same label resolution chain.

C50-L01 (`String.replace()` vs `replaceAll()`) is a new finding not reported in any prior cycle.

---

## Verification of Cycle 47-49 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C49-M01 | **STILL FIXED** | `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];` |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | **PARTIALLY ADDRESSED** | Server-side CSV adapter loop logs warnings, but `catch { continue; }` still doesn't collect errors into ParseResult |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## Active Findings (New in Cycle 50)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C50-M01 | MEDIUM | High | `packages/viz/src/report/generator.ts:75`, `packages/viz/src/terminal/summary.ts:37` | Category display in report/terminal uses English IDs instead of Korean labels | NEW, needs fix |
| C50-L01 | LOW | High | `packages/viz/src/report/generator.ts:225-230` | `String.replace()` only replaces first occurrence -- fragile for future template changes | NEW, low priority |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
