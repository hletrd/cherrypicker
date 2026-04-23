# Cycle 7 — debugger

Focus: reproduce D6-01 and D6-02; identify fixes.

## D6-01 — upload → dashboard waitForURL timeout

### Repro

Run `bunx playwright test e2e/ui-ux-review.spec.js --reporter=line`. Multiple tests hit `waitForURL('**/dashboard', { timeout: 30_000 })`. Under parallel describes (`mode: 'parallel'`) several timeout.

### Diagnosis

See tracer review. Root cause: `test.describe.configure({ mode: 'parallel' })` runs all describes concurrently against a single Astro preview server. Playwright workers × each spawning a full upload pipeline → CPU + single-Node-server contention.

### Fix

Change `e2e/ui-ux-review.spec.js:11` from `mode: 'parallel'` to `mode: 'serial'`.

Alternative if single-file serial is insufficient: `playwright.config.ts` set `workers: 1` globally.

## D6-02 — feature cards render strict-mode violation

### Repro

`bunx playwright test e2e/ui-ux-review.spec.js -g "feature cards render"`. Test at line 67-71.

### Diagnosis

`page.getByText('최적 카드 추천')` resolves to 2 elements:
1. `index.astro:81` — `<h3>최적 카드 추천</h3>` (how-it-works step 3)
2. `index.astro:106` — `<h3 class="font-semibold">최적 카드 추천</h3>` (feature card)

### Fix

Add `data-testid="feature-card-recommend"` on the feature-card div at index.astro:100, and change spec to `page.getByTestId('feature-card-recommend')`. Similar for `지출 분석` (`feature-card-analysis`) and `절약 비교` (`feature-card-savings`).

## Other bugs surfaced by the trace

### B7-01 — `uploadedFiles.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_SIZE` sets errorMessage but keeps files

- File: FileDropzone.svelte:157-161.
- Evidence: the warning is benign but misleading — user sees an error message and thinks the upload failed, but valid files are still staged. Comment notes "Don't set uploadStatus to 'error' — let user proceed" but `errorMessage` is still populated. The error banner at line 516 is only shown when `uploadStatus === 'error'`, so the warning text is invisible. Good.
- Status: not a bug; working as intended.

## Recommendations

- Ship D6-01 serial-mode fix first (one-line, big impact).
- Ship D6-02 testid-based selector fix next.
