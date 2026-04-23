# Cycle 7 — architect

Focus: module boundaries, coupling, separation of concerns.

## Findings

### A7-01 — `e2e/` directory has growing selector-string coupling to Svelte components [MEDIUM / High]

- Evidence: ui-ux-review.spec.js hardcodes many Korean strings (`거래 내역 확인`, `최적 카드 추천`, etc.). Refactors that change copy break tests silently.
- Fix: introduce a `e2e/selectors.ts` module that centralizes testid constants. Tests import the constants; components use `data-testid` matching.
- Status: partially done — cycle 6 added several testids. Continuing the pattern.

### A7-02 — `apps/web/src/lib/store.svelte.ts` bundles persistence + business logic [LOW / Medium]

- File: `store.svelte.ts` — 611 lines.
- Evidence: mixes sessionStorage I/O, schema versioning, migrations, validation, and store mutations. For a module this complex, a separate `persistence.ts` module with `load()`, `save()`, `clear()` would improve testability.
- Fix: refactor — defer; not a correctness issue.

### A7-03 — `apps/web/src/lib/analyzer.ts` imports from `./store.svelte.js` for types [LOW / Low]

- File: `analyzer.ts:10`.
- Evidence: `import type { AnalysisResult, AnalyzeOptions } from './store.svelte.js';`. Circular-ish dependency because store also imports analyzer. Types-only import breaks the cycle at runtime, but conceptually awkward.
- Fix: move `AnalysisResult` and `AnalyzeOptions` to a `types.ts` module owned by neither.

### A7-04 — `packages/core` depends on `@cherrypicker/rules` but not vice versa [OK]

- Evidence: clean unidirectional dependency.

### A7-05 — `apps/web` depends on both `@cherrypicker/core` and `@cherrypicker/rules` [OK]

- Evidence: expected; web is the composition root.

### A7-06 — Multiple empty-state copies scattered [LOW / Low]

- Files: dashboard.astro, SavingsComparison.svelte, OptimalCardMap.svelte, SpendingSummary.svelte, TransactionReview.svelte.
- Evidence: each component declares its own empty-state. Small copy duplication.
- Fix: extract an `<EmptyState>` component — defer.

### A7-07 — No single source of truth for the CSP header [LOW / Medium]

- Evidence: CSP is comment-only in test files; actual CSP policy not located in this pass. Likely in `apps/web/astro.config.*` or a middleware.
- Fix: locate and document. Defer.

## Summary

No HIGH architectural issues. Test-selector coupling (A7-01) is the most actionable; can be addressed incrementally.
