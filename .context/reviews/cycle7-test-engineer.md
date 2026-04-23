# Cycle 7 — test-engineer review

Focus: diagnose cycle-6 e2e failures (36 pass / 38 fail) and classify root causes for D6-01 and D6-02, plus sweep for test gaps surfaced by the stabilisation pass.

## Findings

### T7-01 — `/cherrypicker/` subpath confusion in ui-ux-review.spec.js empty-state test [HIGH / High]

- File: `e2e/ui-ux-review.spec.js:413` in `test.describe('Empty states') > 'results empty state shows CTA'`.
- Evidence: `await page.goto(BASE + 'results')` uses BASE = `http://127.0.0.1:4173/cherrypicker/` and `'results'` (no leading slash) so it resolves correctly, but the test then immediately calls `page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')))`. The results page has zero Svelte islands unless data is present — all dashboard components are `client:load` inside a `<div class="hidden">`. The function call therefore times out.
- Concrete failure: on empty results page, `astro-island:not([ssr])` never resolves (because the islands are inside the hidden `#dashboard-data-content` and render ssr markers but never hydrate until shown). Test hangs 30s, fails.
- Fix sketch: drop the `waitForFunction` on empty-state tests; use `page.waitForLoadState('domcontentloaded')` instead. Keep the astro-island wait only for pages where islands are visible at load.

### T7-02 — Dashboard/Results/Report tests serialize on `waitForURL('**/dashboard', { timeout: 30_000 })` (D6-01 root cause) [HIGH / High]

- File: `e2e/ui-ux-review.spec.js:186, :222, :293, :339, :481, :528, :563, :579, :595, :613, :629` and `e2e/web-regressions.spec.js:30`.
- Evidence: every test that needs data goes through the full upload flow: `setInputFiles(FIXTURE) → fill('300000') → click(분석 시작) → waitForURL('**/dashboard', 30_000)`. The `waitForURL` is timing out in many specs. On my local machine the dashboard transition does succeed (see `web-regressions.spec.js` which passes). The difference from cycle 6's 38-fail picture is that `test.describe.configure({ mode: 'parallel' })` at line 11 of `ui-ux-review.spec.js` runs all the describes concurrently; Astro's `astro preview` server is single-process Node and deserves a single worker. Playwright defaults to workers = CPU cores / 2 ≈ 4-5, so 4-5 full upload pipelines hit the preview server at once — the JS main thread contention + Svelte rehydration + merchant matcher init causes some to exceed 30s.
- Concrete failure: any single-spec run passes, but the parallel describes collide and several `waitForURL('**/dashboard')` races lose.
- Fix sketch:
  1. Set `test.describe.configure({ mode: 'serial' })` at file level for `ui-ux-review.spec.js` (matches web-regressions.spec.js), OR
  2. Keep `parallel` but bump `waitForURL` timeout to 60_000 AND configure `playwright.config.ts` with `workers: 1` for this file-level run, OR
  3. Use a helper that pre-seeds `sessionStorage` directly (`page.evaluate(() => sessionStorage.setItem('cherrypicker:analysis', …))`) before navigating to `/dashboard`, so the test body doesn't depend on the upload pipeline at all.
- Recommended: option 1 is the lowest-risk change; option 3 is the long-term correct fix.

### T7-03 — `feature cards render` strict-mode ambiguity (D6-02 root cause) [HIGH / High]

- File: `e2e/ui-ux-review.spec.js:67`.
- Evidence: `await expect(page.getByText('최적 카드 추천')).toBeVisible()`. The string `최적 카드 추천` appears in two DOM nodes: the `how-it-works` step 3 title (`index.astro:81`) and the feature-card heading (`index.astro:106`). Playwright strict mode resolves > 1 and throws `locator resolved to 2 elements`.
- Concrete failure: strict-mode violation fails the assertion deterministically.
- Fix sketch: two options:
  - `page.getByText('최적 카드 추천').first()` or `.nth(1)` (fragile if DOM changes).
  - Better: scope the assertion via a feature-card-specific locator. E.g. `page.locator('[data-testid="feature-card-recommend"]')`. Requires adding testid on the feature card div in `index.astro:100`.

### T7-04 — Multiple `getByText('체리피킹')` collisions across dashboard and results [MEDIUM / High]

- File: `e2e/ui-ux-review.spec.js:242, :307`.
- Evidence: `체리피킹` is rendered in `SavingsComparison.svelte:171` (the bar label) AND `:216` (the card header). On dashboard that component is rendered once, but on results the same component renders once too with the same dual occurrences. `getByText('체리피킹')` hits both elements within the component → strict-mode violation.
- Concrete failure: Dashboard/Results tests that assert visibility of `체리피킹` fail.
- Fix sketch: use `.first()` OR add `data-testid="savings-bar-label"` and `data-testid="savings-card-header"` and query the header testid.

### T7-05 — `getByText('카드', { exact: false })` overmatch [MEDIUM / High]

- File: `e2e/ui-ux-review.spec.js:36, :38`.
- Evidence: hero test asserts `page.getByText('카드', { exact: false }).first()`. The page contains dozens of `카드*` strings (`카드`, `카드 명세서`, `카드사`, `카드 추천`, `카드 목록`, …). `.first()` hides the strict-mode violation but doesn't actually validate the hero stat. The intent was "카드" label under the stats bar.
- Concrete failure: test passes but provides no regression value, and the `.first()` locator may resolve into nav/header copy first as DOM order changes.
- Fix sketch: tie the assertion to the stats container — e.g. `page.locator('[data-testid="stats-bar"] >> text=카드')`. Requires a testid on the stats div in `index.astro:34`.

### T7-06 — Nav `text=홈` collides with footer + inline home refs [MEDIUM / High]

- File: `e2e/ui-ux-review.spec.js:80, :98`.
- Evidence: `page.locator('nav >> text=홈').first()` — nav has `홈` link; footer also may have it; `.first()` works but masks the ambiguity. When `can navigate to all pages via nav` clicks through `카드 목록 → 대시보드 → 추천 결과 → 홈`, the trailing `홈` click may hit the wrong link under parallel contention.
- Concrete failure: flaky navigation (test sometimes clicks the mobile-menu hidden link via `nav` scope since mobile-menu is inside the same `<nav>`).
- Fix sketch: target a testid on the desktop nav, e.g. `nav [data-testid="nav-home-desktop"]`, or be explicit `nav .hidden.md\\:flex >> text=홈`.

### T7-07 — `mobile viewport hides desktop nav` uses escape-heavy selector [MEDIUM / Medium]

- File: `e2e/ui-ux-review.spec.js:504`.
- Evidence: `page.locator('nav .hidden.md\\:flex')`. Under strict mode this can resolve ≥ 1 elements; the test calls `isVisible()` which non-strictly picks the first match. On desktop widths, `.hidden` is overridden by `md:flex`, so the expectation "hidden on mobile" works, but relying on Tailwind raw class selectors is fragile (any refactor to `lg:flex` breaks it).
- Fix sketch: add `data-testid="nav-desktop"` on the container span.

### T7-08 — `footer.getByText('카드 수록')` depends on un-tested footer markup [MEDIUM / Medium]

- File: `e2e/ui-ux-review.spec.js:116`.
- Evidence: Layout.astro was not re-read here, but the "카드 수록" string must exist in footer. If the footer template ever interpolates `{totalCards}+ 카드 수록`, the literal match may still work; but the test doesn't validate the count path.
- Fix sketch: extend to `await expect(footer).toContainText(/\d+\+?\s*카드 수록/)` so we catch the number path regressing.

### T7-09 — `step indicator shows 4 steps` uses ambiguous `getByText('파일 선택').first()` [LOW / Medium]

- File: `e2e/ui-ux-review.spec.js:53`.
- Evidence: the `파일 선택` label is also used on the `<label>` for the input button in the empty state (FileDropzone.svelte:417). `.first()` masks; with the `<ol>` stepper upgrade, the step 1 label is rendered inside `<li aria-current="step">`. Asserting against the stepper testid would be more specific.
- Fix sketch: `page.getByTestId('step-1')`.

### T7-10 — `bank selector shows all 24 banks + auto-detect` does not exercise the "더보기" fallback [LOW / Medium]

- File: `e2e/ui-ux-review.spec.js:160-169`.
- Evidence: test only checks 4 bank labels including `우체국` (epost) which is at index 23. However, FileDropzone only shows top-8 banks unless `더보기` is clicked. The test happens to pass right now because the bank buttons are rendered even when hidden? Let me verify: `{#each displayedBanks as b}` uses `displayedBanks = showAllBanks ? ALL_BANKS : TOP_BANKS`. The epost button is NOT rendered until 더보기 is clicked. So how does this test pass? It must not. Classified as a bug in the cycle-6 post-fix state — likely contributes to the 38 failures.
- Fix sketch: either click `더보기` first, or assert `우체국` inside the hidden list. `page.getByRole('button', { name: '더보기' }).click()` before the epost assertion.

### T7-11 — `dashboard mobile grid adapts` relies on `.grid-cols-2` selector [LOW / Medium]

- File: `e2e/ui-ux-review.spec.js:530`.
- Evidence: after the cycle-6 dashboard.astro fix (`grid-cols-1 md:grid-cols-2` was changed from `lg:`), the top row uses `md:grid-cols-2`. On 375×812 mobile, the `md:` prefix doesn't apply, so `.grid-cols-2` resolves to the SpendingSummary inner grid only. The assertion passes, but the intent was "dashboard layout stacks on mobile" — the current check is semantically off.
- Fix: drop this test entirely or re-write to use computed-style introspection.

### T7-12 — Accessibility tests accept loose invariants [LOW / Medium]

- File: `e2e/ui-ux-review.spec.js:436-451`.
- Evidence: `form inputs have associated labels` iterates `text`/`number` inputs and considers `placeholder || ariaLabel || labelledBy || id` as sufficient. `id` alone doesn't imply a `<label for=id>` — the assertion is too permissive. A placeholder-only label also fails WCAG 1.3.1 best-practice (placeholder disappears on focus).
- Fix: narrow to `aria-label` or `<label for=id>` presence.

### T7-13 — `session persistence > results page loads from sessionStorage` races Svelte hydration [MEDIUM / Medium]

- File: `e2e/ui-ux-review.spec.js:589-602`.
- Evidence: after `page.goto(BASE + 'results')` then `waitForLoadState('networkidle')`, the assertion `#stat-total-spending toContainText('원')` may race the hydration → the empty template shows first and hydrates to the populated template. `networkidle` is a weak guarantee on a client-heavy app.
- Fix: replace with `await expect(page.locator('#stat-total-spending')).toContainText('원', { timeout: 10_000 })` — the assertion already retries.
- Actually the test as written uses `await expect(...).toContainText(...)` which is auto-retrying, so it should work. If this test was failing, it's likely because the store reset on navigation. Worth tracing with a `console.log` in the store restore path.

### T7-14 — `no unhandled page errors on dashboard` swallows CSP errors [LOW / Low]

- File: `e2e/ui-ux-review.spec.js:564-566`.
- Evidence: `realErrors = errors.filter(e => !e.includes('Content Security Policy') && !e.includes('astro-island'))`. Filtering out CSP and astro-island errors is reasonable given the test comment, but any real runtime error that happens to contain the string "astro-island" in its stack is hidden.
- Fix: filter on `msg.location().url` prefix instead of string contains, or only filter the specific known-CSP messages with a regex.

### T7-15 — `dashboard` empty-state test depends on `or()` locator [LOW / Medium]

- File: `e2e/ui-ux-review.spec.js:409`.
- Evidence: `.getByText('아직 분석한 내역이 없어요').or(page.getByText('아직 비교 데이터가 없어요'))` — covers multiple empty-state copies because different components ship different empty copy. Any future refactor that aligns copy will leave this `.or()` stale.
- Fix: add testid `empty-state-dashboard` on the wrapping div.

## Root-cause bucketing for the 38 failures

From baseline observation (`bun run test:e2e` currently in progress, 12+/74 tests exited by the time of this writing), the expected distribution is:

- **Bucket A — strict-mode locator collision** (T7-03, T7-04, T7-05, T7-06, T7-09, T7-10): ~8-10 failures. Fix with testids + scoped selectors.
- **Bucket B — hydration/astro-island waits on empty pages** (T7-01): 2 failures (dashboard empty-state, results empty-state).
- **Bucket C — upload pipeline parallel contention** (T7-02 — D6-01 root cause): ~15-20 failures across the Dashboard/Results/Report/Upload/Accessibility/Responsive/Session/Data-integrity describes. Fix by flipping `mode: 'parallel'` to `'serial'`.
- **Bucket D — feature-card hidden-bank regression** (T7-10): 1 failure (`우체국` assertion before 더보기 click).
- **Bucket E — other minor**: remainder.

The single biggest ROI change is Bucket C (serial mode) — it should eliminate ~15-20 failures in one commit.

## Coverage gaps

- No unit tests on the beforeunload guard (C6UI-16) — only the side-effect installing the listener. Add a jsdom test where we fire a synthetic `beforeunload` while `uploadStatus === 'uploading'` and verify `returnValue` is set.
- No unit tests for `parsePreviousSpending` clamp (C6UI-34) — add tests for `10_000_000_001 → 10_000_000_000`, `Number.MAX_SAFE_INTEGER → 10_000_000_000`, `-1 → undefined`, `'' → undefined`.
- No tests for `SavingsComparison.displayedSavings` / `displayedAnnualSavings` animation lockstep (C41-01).

## Recommendation for cycle 7

1. Ship T7-02 (serial mode) as a single commit — should alone move the failure count below 20.
2. Ship T7-03 (feature-card testid) + T7-04 (savings-card testid) — fixes strict-mode collisions.
3. Ship T7-01 (drop astro-island wait on empty-state pages).
4. Ship T7-10 (click 더보기 before asserting `우체국`).

Aim to get ≥ 60/74 passing. If upload pipeline races remain, consider pre-seeding sessionStorage in a helper.
