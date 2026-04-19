# Review Aggregate -- 2026-04-19 (Cycle 49)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle49-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-48 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C49-M01 (TS2454 in `llm-fallback.ts`) is a new finding not reported in any prior cycle. The `parsed` variable initialization issue was likely introduced or exposed by a TypeScript version upgrade (the repo now uses TS 5.9.3).

---

## Verification of Cycle 47-48 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C47-L01 | **FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **FIXED** | Terminal `formatRate` has `Number.isFinite` guard |

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

## Active Findings (New in Cycle 49)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C49-M01 | MEDIUM | High | `packages/parser/src/pdf/llm-fallback.ts:84,111` | TS2454: `parsed` variable used before assigned -- breaks `tsc --noEmit` and `bun run build` | NEW, needs fix |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
