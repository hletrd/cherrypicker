# Tracer — Cycle 2 Causal Trace (2026-04-24)

Traced suspicious flows and tested competing hypotheses about correctness.

## Flow Trace 1: Category Label Resolution Path

**Hypothesis:** The three category label maps could cause inconsistent Korean labels depending on which code path is taken.

**Trace:**
1. User uploads file -> `analyzeMultipleFiles()` -> `optimizeFromTransactions()` -> `buildCategoryLabelMap(categoryNodes)` (live data from `categories.json`)
2. If categories.json loads successfully: `buildCategoryLabelMap()` produces labels from live taxonomy. Subcategory keys use dot-notation ONLY (e.g., `dining.cafe` but NOT `cafe`). This is the primary path.
3. If categories.json fails to load (AbortError): `FALLBACK_CATEGORY_LABELS` is used in CardDetail. This map HAS standalone `cafe` key (line 36) which `buildCategoryLabelMap()` would NOT produce.
4. If optimizer runs in CLI mode without `categoryLabels` constraint: `CATEGORY_NAMES_KO` is used as fallback in greedy.ts. This map has `grocery: '식료품/마트'` while the other two have `grocery: '식료품'`.

**Conclusion:** Confirmed — the three maps can produce different labels for the same category depending on the code path. The divergence is most visible for `grocery` (label mismatch) and standalone subcategory keys like `cafe` (presence/absence mismatch).

## Flow Trace 2: sessionStorage Persistence and Recovery

**Hypothesis:** The `_loadPersistWarningKind` module variable could leak across store re-creation.

**Trace:**
1. `loadFromStorage()` sets `_loadPersistWarningKind` at module level (line 216/286/291).
2. `createAnalysisStore()` reads `_loadPersistWarningKind` at line 368-370 and then resets it to null at line 379.
3. Since the store is a singleton (line 603), re-creation only happens during HMR. The module variable is consumed and cleared on each construction.
4. If HMR triggers while `loadFromStorage()` is in-flight (extremely unlikely but possible), the module variable could be overwritten. However, this is a development-only scenario.

**Conclusion:** No production bug. The pattern is safe for the singleton store. Previously tracked as D7-M6.

## No New Findings Beyond Code Reviewer/Architect

The causal traces confirm the findings reported by code-reviewer (C2-CR01/CR02/CR03) and architect (C2-A01/A02). No additional issues found through tracing.
