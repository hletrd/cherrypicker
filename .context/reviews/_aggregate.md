# Review Aggregate -- 2026-04-19 (Cycle 3)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle3-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-50 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C3-M01 (CLI report missing categoryLabels in buildConstraints) is a new finding. C50-M01 fixed the viz package to accept `categoryLabels`, but the CLI's `buildConstraints` call was not updated to pass the labels through. This means the `cardResults.byCategory[].categoryNameKo` values in the CLI report still use the `CATEGORY_NAMES_KO` static fallback rather than the taxonomy-derived labels.

C3-M02 (loadFromStorage cardResults validation) extends D-91 (shallow validation of nested optimization data) by focusing on the rendering consequence of malformed cardResults entries. D-91 was deferred with "if malformed sessionStorage data causes UI rendering errors, add deeper validation" -- this finding provides that triggering scenario.

C3-L01 (CLI prevSpending NaN) is a new finding not reported in any prior cycle. The similar D-28 (FileDropzone parseInt NaN) was promoted and fixed in cycle 4, but the CLI path was not checked.

C3-L02 (getCardById O(n) scan) is a new finding not reported in any prior cycle.

---

## Verification of Cycle 47-50 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C49-M01 | **STILL FIXED** | `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];` |
| C50-M01 | **STILL FIXED** | Viz report generator and terminal summary accept `categoryLabels` parameter |
| C50-L01 | **STILL FIXED** | Report generator uses `replaceAll()` for template placeholder substitution |

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

## Active Findings (New in Cycle 3)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C3-M01 | MEDIUM | High | `tools/cli/src/commands/report.ts:136` | CLI report does not pass `categoryLabels` to `buildConstraints` -- `cardResults.byCategory[].categoryNameKo` uses `CATEGORY_NAMES_KO` fallback instead of taxonomy labels | NEW, needs fix |
| C3-M02 | MEDIUM | Medium | `apps/web/src/lib/store.svelte.ts:159-213` | `loadFromStorage` does not validate `cardResults` entries -- malformed nested data can crash dashboard components | NEW, deferred per D-91 exit criterion |
| C3-L01 | LOW | High | `tools/cli/src/commands/report.ts:50` | `--prev-spending` CLI argument parsed with `parseInt` without NaN validation | NEW, needs fix |
| C3-L02 | LOW | High | `apps/web/src/lib/cards.ts:214-240` | `getCardById` performs O(n) linear scan of all issuers and cards | NEW, low priority |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
