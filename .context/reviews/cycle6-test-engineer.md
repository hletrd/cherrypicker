# Cycle 6 — test-engineer

## Critical test-infra findings

1. **(HIGH, High) The UI/UX e2e spec suite is 100% broken due to port mismatch (C6UI-01).**
   All 57 tests error with `ERR_CONNECTION_REFUSED`. Fix: either switch spec to `:4173` or make both specs read from the env var exported by the playwright webServer.

2. **(HIGH, High) Core-regression fixture expectation is stale (C6UI-40).**
   `e2e/core-regressions.spec.js:149` expects 2 assignments but current rule logic (deliberately) produces 1 for the subcategorized fixture.

3. **(HIGH, High) Missing `data-testid` attributes (C6UI-38).**
   Current tests grep Korean strings; this is fragile — a single copy change broke "총 지출" assertion at cycle N (C6UI-06). Add stable testids to:
   - Stepper: `step-indicator`, `step-{1..4}`.
   - Bank pills: `bank-pill-{issuer}`.
   - Dashboard summary cards: `summary-latest-spending`, `summary-tx-count`, `summary-period`, `summary-top-category`, `summary-effective-rate`.
   - TransactionReview: `tx-review-toggle`, `tx-review-panel`, `tx-category-select-{txId}`.
   - SavingsComparison: `savings-value`, `savings-annual`, `savings-percentage-badge`.
   - CardGrid: `card-card-{cardId}`, `card-filter-type-{val}`.
   Update specs to prefer `getByTestId` over `getByText` for load-bearing elements.

4. **(MEDIUM, High) No test covers refresh-during-upload (C6UI-16).**
   Add a test that sets `uploadStatus='uploading'` via page.evaluate and asserts a `beforeunload` listener is present: `expect(await page.evaluate(() => window.onbeforeunload)).toBeTruthy()`.

5. **(MEDIUM, High) No test covers 전월실적 clamp (C6UI-34).**
   Add `await spinbutton.fill('99999999999'); await expect(spinbutton).toHaveValue('10000000000');` after implementing the clamp.

6. **(LOW, Medium) No accessibility test asserts stepper pattern (C6UI-02).**
   Once migrated to `<ol>` + `aria-current="step"`, add `await expect(step).toHaveAttribute('aria-current', 'step')` per active step.

7. **(LOW, Medium) No visual regression test for dark-mode print (C6UI-13).**
   Add a Playwright test that toggles dark mode, triggers `window.matchMedia('print').onchange`, and asserts `document.documentElement.classList.contains('dark') === false`.

## Coverage gaps by module
- `packages/parser`: good bun-test coverage; no new gap.
- `packages/core`: the greedy optimizer test infra is good, but the cafe/dining subcategory-interaction test (C6UI-40) needs revision.
- `apps/web`: vitest covers the lib; Svelte components still uncovered. Adding testids creates a foundation for future component-level tests.
