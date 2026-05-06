# Architecture Review — CherryPicker Cycle 35

## Methodology
Reviewed package boundaries, coupling, layering, and design risks across the monorepo.

---

## CONFIRMED ISSUES

### ARCH-01: Type leakage between web and core packages
**File**: `apps/web/src/lib/analyzer.ts`, `apps/web/src/lib/store.svelte.ts`
**Severity**: Medium | **Confidence**: High
The web app has elaborate type adapter functions (`toRulesCategoryNodes`, `toCoreCardRuleSets`) that bridge web-local types to core/rules package types. This indicates the packages do NOT share a unified type system.
**Root cause**: Web app has its own `CategoryNode` shape (with `label` instead of `labelKo`/`labelEn`) and its own `CardRuleSet` expectations. The core package was designed separately.
**Fix**: Unify types across packages. Either: (a) make core/rules export the canonical types and have web import them directly, or (b) add a shared `@cherrypicker/types` package. The adapter layer is tech debt.

### ARCH-02: Duplicate optimization result types in store
**File**: `apps/web/src/lib/store.svelte.ts:11-66`
**Severity**: Low | **Confidence**: High
`store.svelte.ts` re-declares `CategoryReward`, `CapInfo`, `CardRewardResult`, `CardAssignment`, `OptimizationResult` — all structurally identical to types in `packages/core/src/models/result.ts`. This violates DRY.
**Fix**: Import types from `@cherrypicker/core` directly.

### ARCH-03: Parser has web/server duplication
**File**: `apps/web/src/lib/parser/`, `packages/parser/src/`
**Severity**: Medium | **Confidence**: High
The parser logic exists in TWO places: `apps/web/src/lib/parser/` (browser) and `packages/parser/src/` (Bun/Node). While there is explicit parity testing (`pdf-parity.test.ts`, `web-detect-parity.test.ts`, `xlsx-parity.test.ts`), maintaining two copies of complex parsing logic is unsustainable.
**Fix**: Consider building the parser package for web (e.g., via `bun build` or Vite) and importing it directly. The parity tests are a band-aid.

---

## LIKELY ISSUES / RISKS

### ARCH-04: store.svelte.ts is too large (666 lines)
**File**: `apps/web/src/lib/store.svelte.ts`
**Severity**: Low | **Confidence**: Medium
The store handles: state management, sessionStorage persistence, migration logic, validation, analysis orchestration, and reoptimization. This is a God Object.
**Fix**: Split into: `analysisStore.ts`, `persistence.ts`, `validation.ts`.

### ARCH-05: Tight coupling between analyzer and store
**File**: `apps/web/src/lib/analyzer.ts`, `apps/web/src/lib/store.svelte.ts`
**Severity**: Low | **Confidence**: Medium
`analyzer.ts` imports from `store.svelte.ts` (`AnalysisResult`, `AnalyzeOptions`) and `store.svelte.ts` imports from `analyzer.ts` (`analyzeMultipleFiles`, etc.). This creates a circular dependency risk.
**Fix**: Move shared types to a dedicated `types.ts` file.

---

## DESIGN DECISIONS (Accepted)

- **Greedy optimizer**: Appropriate for the problem size (NP-hard card selection). Confirmed no need for LP solver.
- **Parser tiering** (structured -> fallback -> LLM): Good progressive enhancement.
- **Card rule YAML**: Human-editable, version-controlled, schema-validated. Good choice.
