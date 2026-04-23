# Cycle 6 — Aggregate review (deduped across agents)

Previous cumulative aggregate retained at `.context/reviews/cycle98-*.md` and related files for provenance. This aggregate is cycle-6 specific.

Provenance files: `cycle6-*.md` per agent + `cycle6-ui-ux-deep.md` (user-injected designer primary).

## Top-priority findings (HIGH severity, cross-agent agreement)

### C6UI-01 — UI/UX e2e spec wrong-port silent failure
Severity HIGH / High confidence. Unanimous cross-agent (designer, verifier, tracer, code-reviewer, test-engineer, debugger, critic).
- `e2e/ui-ux-review.spec.js:7` and `e2e/ui-ux-screenshots.spec.js:7` hardcode `:4174`; `playwright.config.ts:3` uses `port = 4173`. Every test in those specs errors with `ERR_CONNECTION_REFUSED`.
- Fix: use `process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/cherrypicker/'`.

### C6UI-40 — Optimizer regression in core-regressions.spec.js
Severity HIGH / High confidence. Agreed by verifier, tracer, test-engineer, debugger, critic.
- `e2e/core-regressions.spec.js:149` expects 2 assignments; current rule logic (reward.ts:63-80) deliberately excludes broad rules from subcategorized transactions, producing 1 assignment.
- Fix: rewrite the fixture so both transactions legitimately separate (e.g. distinguish merchant conditions), or replace 스타벅스 tx with a non-cafe merchant so broad-dining rule matches.

### C6UI-16 — Data-loss on refresh during upload
Severity HIGH / High confidence. Designer + security + user-injected scope.
- `FileDropzone.svelte:232-266` has no `beforeunload` guard; F5 or navigation during analysis wipes work.
- Fix: add beforeunload handler while `uploadStatus === 'uploading'`.

### C6UI-34 — Unbounded 전월실적 input
Severity HIGH / High confidence. Security + designer + critic.
- `FileDropzone.svelte:439-448` has `min="0"` but no `max`; `parsePreviousSpending` has no clamp. A 10-digit typo inflates projected savings.
- Fix: `max="10000000000"` + `Math.min(n, 10_000_000_000)` in parser.

### C6UI-38 — Zero `data-testid` attributes in the web app
Severity HIGH / High confidence. Designer + test-engineer + critic.
- `grep -r 'data-testid' apps/web/src` → 0 matches. All Playwright selectors depend on Korean copy.
- Fix: add testids incrementally starting with load-bearing surfaces.

### C6UI-08 — TransactionReview amber/red class stacking
Severity HIGH / High confidence (code-reviewer + designer + critic).
- `TransactionReview.svelte:290-292` concatenates two conditional class strings; fragile.
- Fix: short-circuit ternary so `uncategorized` excludes the low-confidence branch.

## MEDIUM severity cluster (25 items)
C6UI-02, 03, 06, 07, 09, 10, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 31, 35, 37, 39. See `cycle6-ui-ux-deep.md` for full detail.

## LOW severity cluster (9 items)
C6UI-04, 05, 11, 14, 28, 30, 32, 33, 36.

## AGENT FAILURES
None — all specialist lanes produced reviews in `cycle6-*.md` files.

## Cross-agent agreement summary
- C6UI-01 appears in 6/11 lanes — strongest signal.
- C6UI-40 appears in 5/11 lanes — unanimous HIGH.
- C6UI-16, -34, -38 each in 3-4 lanes — consistent HIGH.
- C6UI-08: HIGH in code-reviewer + designer; tracer argues for MEDIUM (cascade makes red win anyway). Aggregate keeps HIGH because reorder is silent.

## Divergence vs cycles 4-5
Cycles 4 & 5 reported 0 new findings. Cycle 6 surfaces 40 UI/UX findings plus 1 optimizer-fixture regression — consistent with the user-injected TODO-U1 scope requiring an actual Playwright-driven deep dive.
