# Critic Review -- Cycle 1 (2026-04-22)

## Multi-Perspective Critique

### CT-01: Architecture: Dual runtime (Bun + Node) creates maintenance tax
- **Scope**: Entire monorepo
- **Problem**: `packages/parser/` and `tools/` run on Bun while `apps/web/` runs on Node (Astro). This forces code duplication (csv.ts shared helpers reimplemented in web), prevents shared imports, and creates two separate test runners. The NOTE at `apps/web/src/lib/parser/csv.ts:29-34` explicitly acknowledges this.
- **Failure scenario**: A critical parsing bug is fixed in `packages/parser/src/csv/shared.ts` but the web copy is not updated. Users see different results on web vs CLI.
- **Suggested fix**: Consolidate on a single runtime (Node for web compatibility) or extract browser-safe shared code into a separate package that both can import.
- **Confidence**: High (acknowledged architectural debt, 94+ cycles)

### CT-02: UX: Annual projection "x12" is misleading for variable spending
- **File**: `apps/web/src/components/dashboard/SavingsComparison.svelte:243-244`
- **Problem**: The annual projection simply multiplies the monthly savings by 12. This is mathematically correct for the projection but misleading -- spending patterns vary month to month, and the card performance tier may change.
- **Failure scenario**: A user sees "120,000 won/year savings" but their actual spending changes next month, resulting in a different tier and different rewards. The projection creates a false expectation.
- **Suggested fix**: Already labeled "최근 월 기준 단순 연환산" (simple annual projection based on latest month). Consider adding a confidence indicator or range.
- **Confidence**: Low (already transparently labeled; improvement would be nice-to-have)

### CT-03: Data integrity: Multi-file upload optimizes only latest month
- **File**: `apps/web/src/lib/analyzer.ts:326-344`
- **Problem**: `analyzeMultipleFiles` merges all transactions from all months but only optimizes the latest month (line 338). Previous months' transactions are stored for display but not used in optimization except for computing previousMonthSpending.
- **Failure scenario**: User uploads 6 months of data. Only the latest month gets card optimization. The user sees all transactions but only the latest month's assignments are optimal.
- **Suggested fix**: Either optimize all months independently (with per-month results) or clearly communicate in the UI that only the latest month is optimized.
- **Confidence**: Medium (design choice, not a bug, but user expectation gap)

### CT-04: Type safety: Web CardRuleSet uses `string` for `type` and `source` fields
- **File**: `apps/web/src/lib/cards.ts:37-38,23`
- **Problem**: The web `CardRuleSet` interface defines `type: string` and `source: string` instead of the union types (`'credit' | 'check' | 'prepaid'` and `'manual' | 'llm-scrape' | 'web'`) used in the core package. The `analyzer.ts` bridges this with `VALID_SOURCES` and `VALID_REWARD_TYPES` sets (lines 40-41).
- **Failure scenario**: A new reward type is added to the core schema (e.g., 'voucher'). The web CardRuleSet accepts it as `string` but `VALID_REWARD_TYPES` in analyzer.ts doesn't include it, silently falling back to 'discount'.
- **Suggested fix**: Use the same Zod-inferred types from `@cherrypicker/rules` in the web package, or at minimum share the union type definitions.
- **Confidence**: Medium (type narrowing works today but is fragile)

### CT-05: Resilience: No retry or recovery for failed card data fetch
- **File**: `apps/web/src/lib/cards.ts:193-241`
- **Problem**: `loadCardsData` returns `undefined` on AbortError and throws on other errors. There is no retry mechanism for transient network failures. If the initial fetch fails (non-abort), the cache is cleared and the next call retries, but there's no exponential backoff or retry limit.
- **Failure scenario**: A momentary network glitch during the initial page load causes `loadCardsData` to throw. The dashboard shows an error state. The user must manually refresh the page.
- **Suggested fix**: Add a simple retry mechanism (2-3 retries with backoff) for non-abort fetch failures.
- **Confidence**: Low (network failures are rare for static JSON; user can refresh)

### CT-06: Observability: console.warn/debug scattered throughout core
- **Files**: `packages/core/src/calculator/reward.ts:196,265,287`, `packages/core/src/optimizer/ilp.ts:48`
- **Problem**: The core package uses `console.warn` and `console.debug` directly, with no structured logging or log levels. In production web usage, these go to the browser console and are invisible to most users.
- **Failure scenario**: A card rule has both rate and fixedAmount (schema allows it but refinement warns). The warning is only visible in the browser console, not surfaced to the user who may be making incorrect financial decisions based on the reward calculation.
- **Suggested fix**: Use a structured logging interface that can be configured per-environment. Surface actionable warnings (like misconfigured rules) in the UI.
- **Confidence**: Medium (actionable warnings should reach the user)
