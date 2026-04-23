# Cycle 8 — architect

## Inventory of architectural concerns (carried from cycle 7 A7-01/02/03)

- A7-01: selector-string coupling between e2e and components.
- A7-02: persistence module needs extraction from `store.svelte.ts`.
- A7-03: shared type-package split (core types leak into both analyzer.ts and store.svelte.ts).

## Re-audit

### A7-01 (selector coupling)

Current state: components use a mix of `data-testid`, role+name, and text selectors. E2E specs mostly use text + `.first()` patterns. Cycle 7 added testids on feature cards + stepper. Moving the rest is a 2-3 day polish task.

Severity: MEDIUM / Medium. **Keep deferred.** Exit criterion: dedicated refactor cycle to migrate all e2e selectors to testid-first.

### A7-02 (persistence module extraction)

Current state: `store.svelte.ts` contains 400+ LoC of serialization, validation, versioning, and migration logic inline. Extracting to `apps/web/src/lib/persistence.ts` would (a) shrink store.svelte.ts, (b) enable unit testing of persistence without Svelte runtime, (c) unblock D7-M6.

Severity: MEDIUM / Medium. **Keep deferred.** Exit criterion: dedicated refactor cycle.

### A7-03 (type-package split)

Current state: `analyzer.ts` re-exports `CategorizedTx` from `packages/parser`; `store.svelte.ts` re-imports from `analyzer.ts`. A `packages/types` shared package would centralize.

Severity: MEDIUM / Medium. **Keep deferred.** Exit criterion: dedicated type-package split.

## New architectural findings

None this cycle. The architecture is stable; refactors are on the roadmap.

## Recommendation

- All three architect carry-overs (A7-01/02/03) remain deferred. Severity preserved. Exit criteria unchanged.
