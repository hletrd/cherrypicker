# Architect Review -- Cycle 1 (2026-04-22)

## Findings

### AR-01: Dual runtime split (Bun + Node) creates architectural boundary
- **Scope**: `packages/parser/` (Bun) vs `apps/web/` (Node/Astro)
- **Problem**: The monorepo has two runtime targets. `packages/parser/` uses Bun APIs and `tools/cli/` runs on Bun, while `apps/web/` runs on Node with Astro. This forces code duplication (csv parsing helpers, bank signatures, date utilities) across the boundary.
- **Risk**: Any change to shared logic (parsing, detection, categorization) must be manually replicated on both sides. The NOTE at `apps/web/src/lib/parser/csv.ts:29-34` acknowledges this as "D-01 architectural refactor."
- **Suggested fix**: Create a `packages/shared/` package that is runtime-agnostic (no Bun or Node specific APIs). Move pure-logic utilities (date parsing, amount parsing, bank detection) there. Both Bun and Node consumers import from this shared package.
- **Confidence**: High (fundamental architectural issue, 94+ cycles flagging)

### AR-02: Core package has side effects (console.warn)
- **File**: `packages/core/src/calculator/reward.ts:196,265,287`
- **Problem**: The core optimization engine uses `console.warn` directly, coupling it to the console API. This makes the package unsuitable for non-console environments (e.g., web workers, server-side rendering) and prevents structured error reporting.
- **Risk**: Warnings about misconfigured card rules (e.g., both rate and fixedAmount present) are only visible in the developer console, not surfaced to end users who are making financial decisions based on the output.
- **Suggested fix**: Return warnings as part of the `CalculationOutput` (e.g., add a `warnings: string[]` field). Let the caller decide how to surface them.
- **Confidence**: Medium (layering violation, but no functional impact today)

### AR-03: Web store couples persistence, state management, and business logic
- **File**: `apps/web/src/lib/store.svelte.ts:352-601`
- **Problem**: `createAnalysisStore` handles three concerns: (1) reactive state management, (2) sessionStorage persistence/recovery with versioning and validation, and (3) business logic (analysis, reoptimization). The function is 250 lines with deeply nested logic.
- **Risk**: Changes to persistence logic (e.g., adding a migration) can accidentally break the state management or business logic, and vice versa.
- **Suggested fix**: Extract persistence into a separate module (e.g., `persistence.ts` with `persist()` and `recover()` functions). The store should only coordinate between state, persistence, and analysis.
- **Confidence**: Medium (separation of concerns, not a functional issue)

### AR-04: Type duplication between web and core/rules packages
- **Files**: `apps/web/src/lib/cards.ts:14-52` vs `packages/rules/src/types.ts`
- **Problem**: The web `CardRuleSet`, `RewardTier`, `RewardEntry` interfaces are locally defined with `string` types for fields that are union types in the rules package. The `analyzer.ts` bridges this with runtime validation (`VALID_SOURCES`, `VALID_REWARD_TYPES`).
- **Risk**: Adding a new enum value to the rules package (e.g., a new reward type) requires updating the web types AND the validation sets. Missing either silently degrades behavior.
- **Suggested fix**: Import types from `@cherrypicker/rules` in the web package. If the web package can't import from rules due to the runtime split, share type definitions through the proposed `packages/shared/` package.
- **Confidence**: High (type drift risk is real and acknowledged)

### AR-05: CATEGORY_NAMES_KO / CATEGORY_COLORS / formatIssuerNameKo are three parallel maps
- **Files**: `packages/core/src/optimizer/greedy.ts:11-86`, `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-84`, `apps/web/src/lib/formatters.ts:52-79`
- **Problem**: Three separate hardcoded maps (86 entries, 84 entries, 27 entries) must all be kept in sync with the YAML taxonomy and issuer data. Adding a new category or issuer requires updating all three.
- **Risk**: A new category added to the taxonomy but not to CATEGORY_NAMES_KO shows raw English keys; not in CATEGORY_COLORS shows gray; not in formatIssuerNameKo shows the raw ID.
- **Suggested fix**: Generate these maps from the YAML data at build time using a codegen step. The taxonomy YAML is the single source of truth.
- **Confidence**: High (three-way sync is a known maintenance burden)

### AR-06: No abstraction layer for reward calculation strategies
- **File**: `packages/core/src/calculator/reward.ts:90-111`
- **Problem**: `getCalcFn` uses a switch statement to select the calculation function. All four types (discount, points, cashback, mileage) delegate to `calculatePercentageReward`. The only difference is the function reference, not the behavior.
- **Risk**: If a new reward type with different calculation logic (e.g., tiered rates, progressive rates) is added, the switch statement must be extended and the single `calculatePercentageReward` function may not suffice.
- **Suggested fix**: Define a `RewardStrategy` interface with a `calculate` method. Each reward type implements the interface. The calculator delegates to the strategy.
- **Confidence**: Low (current uniformity makes this over-engineering today, but a useful pattern for future extensibility)
