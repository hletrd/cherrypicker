# Cycle 6 — code-reviewer (Opus 4.7 / 1M)

## New findings this cycle

1. **(HIGH, High) C6UI-08 — TransactionReview amber/red class ternaries are concatenated, not short-circuited.**
   `apps/web/src/components/dashboard/TransactionReview.svelte:290-292`. Two conditional class strings both emit when a tx is uncategorized AND confidence < 0.5; cascade picks the later utility, producing visual ambiguity. Fix: nest ternaries so `uncategorized` wins over `confidence < 0.5`.

2. **(HIGH, High) C6UI-01 — e2e/ui-ux-review.spec.js:7 and e2e/ui-ux-screenshots.spec.js:7 hard-code `:4174`; config uses `:4173`.**
   Every test errors with connection-refused. Fix: replace literal with `process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/cherrypicker/'`.

3. **(HIGH, High) C6UI-40 — e2e/core-regressions.spec.js:149 expectation out of sync with reward.ts:63-80 rule-matching logic.**
   Test expects the broad-dining fixture to match `dining.cafe` transactions, returning 2 assignments. The calculator deliberately excludes broad rules from subcategorized transactions (comment cites Korean card terms). Fix: update fixture (prefer adding `includeSubcategories: true` on the broad fixture when that schema flag exists, or rewrite the test to reflect the documented behavior).

4. **(MEDIUM, High) C6UI-13 — duplicate print handlers. results.astro uses inline `onclick="window.print()"`; report.astro uses `cherrypickerPrint()` which strips `.dark` first.**
   Consolidation: export `cherrypickerPrint` from `public/scripts/print.js` and call from both pages.

5. **(MEDIUM, High) C6UI-34 — FileDropzone.svelte:439-448 numeric input lacks `max`; parsePreviousSpending:225-230 has no clamp.**
   Add `max="10000000000"` and `Math.min(n, 10_000_000_000)` in the parser.

6. **(LOW, High) C6UI-14 — report.astro:71-75 `afterprint` listener does not restore theme on cancelled print.**
   Pair with `beforeprint` + 2s fallback timeout.

7. **(LOW, Medium) FileDropzone.svelte:156-178 error-surface ordering.**
   The 50MB soft warning is overwritten by per-file hard errors — split into two visible surfaces so the user sees both.

## Pre-existing findings still unresolved
None newly re-surfaced; see `code-reviewer.md` for the prior cumulative file (preserved for provenance).
