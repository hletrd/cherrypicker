# Cycle 10 — code-reviewer

Scope: apps/web (store, analyzer, FileDropzone, dashboard components), packages/core/rules, playwright/e2e configs, recent cycle 8/9 commits. Verified against cycle 9 aggregate baseline.

## Methodology
- Re-read `apps/web/src/lib/store.svelte.ts` (post-C9-01 `setResult` deletion, lines 452-601).
- Re-read `apps/web/src/lib/analyzer.ts` (cardRules cache, `optimizeFromTransactions`, `analyzeMultipleFiles`, `getLatestMonth`).
- Re-read `apps/web/src/components/upload/FileDropzone.svelte` (onMount/onDestroy, `parsePreviousSpending`, handleUpload, `beforeUnloadGuard`).
- Grepped for dead-code, race-risky patterns, missing invariants, API contract drift across `apps/`, `packages/`, `tools/`, `e2e/`.

## Findings

### C10CR-00 — No new actionable findings [High]
- File refs: the post-C9-01 codebase passes all prior cycle audits.
- Evidence:
  - `rg setResult apps/ e2e/ packages/ tools/` → zero hits outside `.context/**` documentation. `setResult` is gone.
  - `generation++` invariant remains: set once in `analyze()` (line 465) and once in `reoptimize()` (line 575). Both sites also call `persistToStorage` and assign `persistWarningKind`/`truncatedTxCount` atomically.
  - `invalidateAnalyzerCaches()` still wired only in `reset()` (line 597). No path creates a result without going through `analyze()` or `reoptimize()`.
  - `parsePreviousSpending` (FileDropzone.svelte:222-253) correctly handles `unknown` input type with -0 coercion (C7E-01 + C8-02 regression-tested).
  - `navigateTimeout` (FileDropzone.svelte:7, :289, :314, onDestroy :8) correctly cleared on four code paths: onDestroy, before-reassignment, handleRetry, and intentionally on success (fires navigate).
  - `beforeUnloadGuard` (FileDropzone.svelte:259-264, :270/:309) added+removed symmetrically around analyzeMultipleFiles.

### Deferrals re-confirmed this cycle
- D7-M6 `_loadPersistWarningKind` module-mutable (store.svelte.ts:216-220,:379) — still present. Exit criterion (persistence extracted to dedicated module, tied to A7-02) unchanged.
- D7-M7 `reuseExistingServer: !process.env.CI` (playwright.config.ts:19) — still present. Exit criterion (CI pipeline) unchanged.
- D7-M12 `getAllCardRules` refetched per reoptimize (analyzer.ts:185-201) — cache hit path works (cachedCoreRules) but `getAllCardRules()` itself still re-flatMaps on every call. Exit criterion (profiler bottleneck) unchanged.
- D7-M13 `script-src 'unsafe-inline'` (apps/web/src/layouts/Layout.astro:42) — still present; comment at :30-40 documents the constraint.
- D7-M5 silent-drop of malformed-date rows from monthlyBreakdown — unchanged.
- D7-M14 e2e selector polish (T7-05..T7-15) — unchanged.
- D8-01 `prefers-reduced-motion` rule for spinner — `app.css:102` has a generic `@media (prefers-reduced-motion: reduce)` block but the `animate-bounce` + `animate-spin` classes on the upload success/loading icons are not individually gated. Keep deferred to a11y cycle.
- D8-02 dashboard cards lack `role="region"` + `aria-labelledby` — still unchanged.

## Cross-agent overlap expected
- perf-reviewer: D7-M12 (cardRules); architect: D7-M6, D7-M11 persistence extraction; security-reviewer: D7-M13 CSP.

## Confidence
High for "no net-new actionable findings". The cycle-9 delete of `setResult` closed the last MEDIUM-severity deferrable. Remaining items require dedicated refactor/a11y/CI cycles.
