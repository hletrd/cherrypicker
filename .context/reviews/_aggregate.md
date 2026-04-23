# Cycle 7 — aggregate review

Deduplicated findings across `cycle7-test-engineer.md`, `cycle7-e2e-failure-diagnosis.md`, `cycle7-code-reviewer.md`, `cycle7-critic.md`, `cycle7-tracer.md`, `cycle7-perf-reviewer.md`, `cycle7-security-reviewer.md`, `cycle7-designer.md`, `cycle7-architect.md`, `cycle7-debugger.md`.

Provenance files retained at the per-agent `cycle7-*.md` and the cycle-6 set under `.context/reviews/cycle6-*.md`.

Prior convergence history: cycles 95–98 reported zero actionable findings; cycle 5 (UI/UX deep-dive) re-opened with 40+ findings; cycle 6 landed 9 HIGH/MEDIUM fixes but deferred D6-01 (upload-to-dashboard timeout) and D6-02 (feature-card strict-mode collision). Cycle 7 targets both plus the 38 failing Playwright tests.

## HIGH — in-scope for cycle 7 (implement now)

| Id | Source agents | File:line | Description |
|----|---------------|-----------|-------------|
| C7-E01 | test-engineer T7-02, tracer, debugger, critic CR7-12 | `apps/web/src/components/upload/FileDropzone.svelte:222-234` (root) + `e2e/ui-ux-review.spec.js:11` (amplifier) | **`t.trim is not a function` during upload.** Svelte 5 `bind:value` on `<input type="number">` coerces the bound `$state<string>('')` to a `number` at runtime. `parsePreviousSpending(raw).trim()` then throws. The thrown error is caught inside `analysisStore.analyze()`, sets `error`, sets `result = null`, so `waitForURL('**/dashboard')` never resolves and hits the 30s timeout. This is the REAL root cause of D6-01. Fix: coerce to string in parsePreviousSpending. |
| C7-E02 | test-engineer T7-02, tracer, debugger, critic CR7-12 | `e2e/ui-ux-review.spec.js:11` | **Parallel describe mode collides with single-process Astro preview.** Even after C7-E01, parallel workers driving concurrent upload pipelines at one preview server can cause residual flakes. Fix: `test.describe.configure({ mode: 'serial' })`. |
| C7-E03 | test-engineer T7-03, designer D7-01, debugger, e2e-diag-bucket-A | `e2e/ui-ux-review.spec.js:67-72` + `apps/web/src/pages/index.astro:88-122` | **D6-02 strict-mode collision.** `getByText('최적 카드 추천')` resolves to 2 elements. Fix: add `data-testid="feature-card-{analysis,recommend,savings}"`; update spec. |
| C7-E04 | test-engineer T7-04, e2e-diag-bucket-A | `e2e/ui-ux-review.spec.js:242, :304-307` | `체리피킹` + `카드 한 장` collide inside SavingsComparison (bar label + card header). Fix: `.first()`. |
| C7-E05 | test-engineer T7-10, e2e-diag-bucket-D | `e2e/ui-ux-review.spec.js:160-169` | `우체국` hidden behind 더보기. Fix: click 더보기 before asserting. |
| C7-E06 | test-engineer T7-01, e2e-diag-bucket-B | `e2e/ui-ux-review.spec.js:406-420` | `waitForFunction(astro-island:not([ssr]))` times out on empty-state pages because islands live inside a hidden container. Fix: drop the wait. |
| C7-E07 | critic CR7-02 | `package.json:17` | `test:e2e` build step doesn't include the web app. Fix: widen the turbo build. |

## MEDIUM — plan-only updates in cycle 7

| Id | Source | Description |
|----|--------|-------------|
| C7-D01 | critic CR7-10 | Refresh `00-deferred-items.md` with resolved D6-01/D6-02 plus new D7-Mxx entries. |
| C7-D02 | critic CR7-05 | C6UI-04, C6UI-05 remain deferred but keep their WCAG 1.4.11 AA severity — NOT downgraded to LOW. |

## MEDIUM / LOW — deferred with severity preserved + exit criteria

| Id | Source | File:line | Severity | Reason to defer | Exit criterion |
|----|--------|-----------|----------|-----------------|----------------|
| D7-M1 | code-reviewer C7CR-01 | `apps/web/src/lib/store.svelte.ts:601-602` | LOW / High | dead assignment; no runtime effect | refactor with C7CR-09 |
| D7-M2 | code-reviewer C7CR-02 | `apps/web/src/lib/store.svelte.ts:452-459` | MEDIUM / Medium | `setResult` footgun; no current callers | first caller added or method deleted |
| D7-M3 | code-reviewer C7CR-03 | `apps/web/src/components/upload/FileDropzone.svelte:266-277` | MEDIUM / Medium | rapid-re-upload race; no user report | double-click reproducer test |
| D7-M4 | code-reviewer C7CR-06 | `FileDropzone.svelte:228-234` | LOW / Medium | `-0` accepted; cosmetic | strict-sign test |
| D7-M5 | code-reviewer C7CR-07 | `apps/web/src/lib/analyzer.ts:322-333` | LOW / Medium | silent drop of malformed-date rows documented as C6-01 | user reports missing transactions |
| D7-M6 | code-reviewer C7CR-09 | `apps/web/src/lib/store.svelte.ts:216-220, :379` | MEDIUM / High | module-level mutable state; testability | persistence module extraction |
| D7-M7 | critic CR7-01 | `playwright.config.ts:19` | MEDIUM / Medium | `reuseExistingServer` masks stale builds | revisit when CI pipeline added |
| D7-M8 | critic CR7-06 | repo-wide | MEDIUM / Medium | no axe-core a11y gate | dedicated a11y cycle |
| D7-M9 | critic CR7-11 | `e2e/ui-ux-screenshots.spec.js` | LOW / Low | manual-review smoke harness; intentional | toMatchSnapshot migration |
| D7-M10 | designer D7-05 | `FileDropzone.svelte:490-505` | LOW / Medium | spinner lacks `aria-busy` | a11y gate cycle |
| D7-M11 | architect A7-01 / A7-02 / A7-03 | multiple | MEDIUM / Medium | architectural refactors | dedicated refactor cycle |
| D7-M12 | perf-reviewer P7-01 | `apps/web/src/lib/analyzer.ts:186-201` | LOW / High | cardRules refetched per reoptimize | profiling shows bottleneck |
| D7-M13 | security-reviewer S7-01 | Astro CSP | MEDIUM / High | `unsafe-inline` still in script-src | Astro nonce-based CSP lands |
| D7-M14 | test-engineer T7-05, T7-06, T7-07, T7-09, T7-11, T7-12, T7-13, T7-14, T7-15 | various | LOW / Medium | test-selector polish | follow-up test-engineer cycle |

No security, correctness, or data-loss finding is deferred this cycle. All previously-deferred HIGH items from cycle 6 (D6-01, D6-02) are resolved in-scope via C7-E01 / C7-E02 / C7-E03.

C6UI-04, C6UI-05 (WCAG 1.4.11 non-text contrast, AA) remain deferred. Severity preserved as MEDIUM (SC 1.4.11 is an AA item, not LOW as cycle-6 plan implied). Exit criterion: an a11y-focused cycle that lands axe-core in Playwright.

C6UI-23 (target size) remains deferred; already meets SC 2.5.8 at 24×24 — exit criterion is the AAA upgrade (44×44) when that becomes prioritised.

## Agent failures

None.

## Cross-agent agreement

- **test-engineer + tracer + debugger + critic** converge on C7-E01 (`t.trim`) being the real D6-01 root cause, with C7-E02 (parallel contention) as a secondary amplifier.
- **test-engineer + debugger + designer** converge on C7-E03 (feature-card testid).
- **test-engineer + critic** converge on C7-E07 (widen `test:e2e` build scope).

## Plan hand-off

See `.context/plans/cycle7-orch-plan.md` for the implementation plan.
