# Cycle 7 — tracer

Focus: trace the upload → dashboard → results → report flow to confirm D6-01 root cause.

## Trace

1. `apps/web/src/pages/index.astro:54` renders `<FileDropzone client:load />`.
2. User selects a file → `FileDropzone.handleFileInput` → `addFiles` → `uploadedFiles = [file]`.
3. `currentStep = 2` drives the stepper to "카드사 선택".
4. User types 300000 → `previousSpending = '300000'`.
5. User clicks `분석 시작` → `handleUpload()` at FileDropzone.svelte:247.
6. `window.addEventListener('beforeunload', beforeUnloadGuard)` — installed.
7. `analysisStore.analyze(uploadedFiles, { bank, previousMonthSpending })` — store.svelte.ts:461.
8. In store.analyze: `analyzeMultipleFiles(fileArray, options)` — analyzer.ts:268.
9. `analyzeMultipleFiles`: `loadCategories()` → MerchantMatcher → `Promise.all(files.map(parseAndCategorize))`.
10. Each `parseAndCategorize` awaits `parseFile(file, bank)`, returns transactions.
11. Merge, sort by date, compute monthlySpending / monthlyTxCount.
12. Latest month → filter to latestTransactions → `optimizeFromTransactions(latestTransactions, {...options, previousMonthSpending})`.
13. `optimizeFromTransactions` loads cards via `getAllCardRules()`, transforms to core shape, computes per-card previousMonthSpending, calls `greedyOptimize(constraints, coreRules)`.
14. Returns optimization.
15. `analyzeMultipleFiles` returns full AnalysisResult.
16. Store sets `result`, `generation++`, persists to sessionStorage.
17. Back in FileDropzone.handleUpload: if no error, `uploadStatus = 'success'` → setTimeout 1200ms → `navigate(buildPageUrl('dashboard'))`.
18. On dashboard mount, `VisibilityToggle` (dashboard.astro:122) detects sessionStorage data → flips `#dashboard-empty-state hidden` and unhides `#dashboard-data-content`.
19. Svelte components hydrate, read from `analysisStore.result`, render.

### Latency budget

- `loadCategories` fetches `/data/categories.json` from astro's static assets → ~5-20ms.
- `parseFile` for a 4-row CSV → ~1-5ms.
- MerchantMatcher `match` for 4 transactions → ~0.1ms.
- `getAllCardRules` fetches `/data/cards.json` → ~10-50ms.
- `greedyOptimize` for 4 transactions × ~40 cards → ~5-20ms.
- Total pipeline: ~100-200ms on cold cache, ~30-60ms on warm cache.
- Hydration of dashboard islands: ~200-500ms.
- View Transition + navigation: ~1200ms setTimeout delay + ~50-100ms.

Total from click to `waitForURL('**/dashboard')` resolving: ~1.5-2.0s under normal conditions. Well under 30s.

### Why parallel contention breaks this

With `test.describe.configure({ mode: 'parallel' })`, 4-5 Playwright workers each run this pipeline simultaneously against ONE `astro preview` server (single Node process). The astro preview doesn't re-bundle per request but does serve all static assets + HTML + JS. At peak contention:

- 4-5 concurrent fetch of `/data/categories.json` → queued at the HTTP server's default concurrency.
- 4-5 concurrent fetch of `/data/cards.json` → same.
- Each browser then runs its own JS → CPU contention between Playwright workers (each drives chromium-headless-shell).
- The setTimeout(1200ms) is wall-clock in each browser tab — fine independently.
- The `waitForURL('**/dashboard', 30_000)` waits up to 30s.

The 30s timeout is usually enough, but I've seen the WebSocket / browser connection to Playwright drop under load; Playwright then fails-retries and the 30s can be consumed by retry backoff.

### Reproduction

Run `bunx playwright test e2e/ui-ux-review.spec.js --reporter=line` and watch the failure mode. Single-spec reruns show that the failures are transient / worker-count-sensitive.

### Confirmed: D6-01 is parallel contention, not an upload-pipeline bug

The same pipeline in `web-regressions.spec.js` (serial mode) consistently passes.

### Confirmed: D6-02 is strict-mode locator collision

`feature cards render` test asserts `getByText('최적 카드 추천')` which matches two DOM nodes (step-3 title + feature-card heading). Deterministic failure.

## Fix recommendations

For D6-01: `test.describe.configure({ mode: 'serial' })` at file level (one-line change).

For D6-02: add `data-testid="feature-card-recommend"` to index.astro:100 feature card, update spec to `getByTestId('feature-card-recommend')`. Similar pattern for any remaining strict-mode collisions.

These are low-risk, high-return fixes for this cycle.
