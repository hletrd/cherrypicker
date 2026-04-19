# Review Aggregate — 2026-04-19 (Cycle 9)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle9-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-8 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-8 findings have been verified as fixed or deferred. Cycle 8 fixes (C8-01 through C8-13) are all correctly implemented. They are not re-listed here.

Deferred items D-01 through D-69 and LOW items from cycle 8 remain unchanged and are not re-listed here.

---

## Verification of Cycle 8 Fixes

All 4 implemented cycle 8 fixes verified as correctly implemented:
- C8-02+C8-03: PDF Korean/short-date patterns in fallback and findDateCell
- C8-11: Reset `_loadPersistWarningKind` after consumption and in store reset
- C8-01: NaN guard in SpendingSummary formatPeriod
- C8-09: Category labels cached in store and passed through reoptimize

---

## Active Findings (New in Cycle 9, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C9-01 | MEDIUM | High | `analyzer.ts:191-194` | `toCoreCardRuleSets` cache never hits — reference equality always fails for re-fetched rules | Extends D-61 |
| C9-02 | LOW | High | `SavingsComparison.svelte:71-75,176-180` | `savingsPct` is 0 when optimization is identical — redundant comparison UI | New |
| C9-03 | MEDIUM | Medium | `detect.ts:114-137` | Bank detection tie-breaking is undefined — first-in-array wins | Extends D-65/C8-07 |
| C9-04 | LOW | High | `pdf.ts:312-331` | Fallback date regex is complex and hard to maintain | New |
| C9-05 | MEDIUM | High | `store.svelte.ts:334-351` | `reoptimize` silently discards edits when `result` is null | New |
| C9-06 | LOW | Medium | `CategoryBreakdown.svelte:78-79` | Percentage rounding can shift the "other" threshold by 0.05% | Extends D-59/C7-10 |
| C9-07 | LOW | Medium | `OptimalCardMap.svelte:18-19` | `Math.max(...array)` stack overflow risk for very large arrays | New |
| C9-08 | LOW | High | `SavingsComparison.svelte:78-82` | Comparison bars misleading when both rewards are 0 | New |
| C9-09 | LOW | Low | `cards.ts:159-173` | Categories cache never invalidated — same as D-07/D-54 | Duplicate of D-07/D-54 |
| C9-10 | LOW | High | `xlsx.ts:290-294` | HTML-as-XLS double-decode and unnecessary re-encode | Extends D-52/C6-06 |
| C9-11 | MEDIUM | Medium | `store.svelte.ts:139-149` | `isValidTx` allows empty-string fields — transactions with empty category silently skip | Extends D-27 |
| C9-12 | LOW | Medium | `analyzer.ts:43-44` | Module-level `cachedCoreRules` persists across store resets | New |
| C9-13 | MEDIUM | High | `SpendingSummary.svelte:101-106` | `monthlyBreakdown` relies on Map insertion order being chronological — fragile implicit contract | New |

---

## Cross-Agent Agreement (Cycle 9)

| Finding | Signal |
|---|---|
| C9-01 / D-61 | Same root cause (cache reference equality). D-61 identified the `toCoreCardRuleSets` cache; C9-01 provides the concrete mechanism (flatMap creates new array every call). Combined signal is HIGH — this is a real missed optimization. |
| C9-03 / D-65 / C8-07 | Same root cause (detectBank confidence scoring). C9-03 adds the tie-breaking angle. Combined signal is MEDIUM — the scoring is imperfect but rarely causes wrong detection. |
| C9-06 / D-59 / C7-10 | Same class (percentage rounding). C9-06 identifies a specific threshold-shifting case. Combined signal is LOW — visual artifact only. |
| C9-10 / D-52 / C6-06 | Same finding (double decode in xlsx). C9-10 adds a specific optimization suggestion (use `{ type: 'string' }`). Combined signal is LOW. |
| C9-11 / D-27 | Same class (transaction ID/data quality). C9-11 identifies that validation allows empty strings. Combined signal is MEDIUM. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C9-05: Add error feedback when `reoptimize` silently discards edits due to null result
2. C9-01: Fix `toCoreCardRuleSets` cache to actually work — remove reference equality check

### MEDIUM (plan for next cycles)
3. C9-03: Document or improve bank detection tie-breaking behavior
4. C9-11: Add non-empty string checks to `isValidTx` validation
5. C9-13: Explicitly sort `monthlyBreakdown` by month before rendering

### LOW (defer or accept)
- C9-02, C9-04, C9-06, C9-07, C9-08, C9-09 (dup of D-07), C9-10, C9-12

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
