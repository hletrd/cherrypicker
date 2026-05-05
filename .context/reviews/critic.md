# Critic — Cycle 4 Findings

## Summary
8 findings. 2 critical design flaws, 3 high, 3 medium. Focused on architectural debt and deferred-fix violations.

## Findings

### F-CRI-01 [CRITICAL] Server/web parser parity gap
- **Files**: `packages/parser/src/` vs `apps/web/src/lib/parser/`
- **Issue**: Web-side parsers are hand-copied duplicates of server parsers. Every parser fix must be applied twice. Cycle 2 fixed negative amounts in server parsers but web parsers still diverge (e.g., OFX, HTML, JSON not in web).
- **Fix**: Either share code via isomorphic package, or automate parity testing.

### F-CRI-02 [CRITICAL] Greedy optimizer hardcodes category names
- **File**: `packages/core/src/optimizer/greedy.ts` lines 11-89
- **Issue**: 79-line hardcoded `CATEGORY_NAMES_KO` map duplicates `packages/rules/data/categories.yaml`. Adding a category requires editing two files.
- **Fix**: Generate at build time from YAML, or import YAML directly in Bun environments.

### F-CRI-03 [HIGH] No formal optimization correctness proof
- **File**: `packages/core/src/optimizer/greedy.ts`
- **Issue**: Greedy algorithm has no guarantee of optimal assignment. No benchmark against brute-force for small N, no confidence interval.
- **Fix**: Add brute-force verifier for N<=10 cards, document approximation ratio.

### F-CRI-04 [HIGH] Card rules type redefined in web app
- **File**: `apps/web/src/lib/cards.ts` lines 14-52
- **Issue**: Web app duplicates `CardRuleSet` type instead of importing from `@cherrypicker/rules`. Schema changes require manual sync.
- **Fix**: Import shared types. Use `satisfies` for any web-specific extensions.

### F-CRI-05 [HIGH] Deferred-fix violations in cycle history
- **File**: `.omc/plans/` (cycle 2, cycle 3)
- **Issue**: Plans marked "deferred" but no tracking system ensures they are revisited. Some deferred items appear in multiple cycles without progress.
- **Fix**: Add deferred-fix registry with cycle-numbers and assignees.

### F-CRI-06 [MEDIUM] PDF parsing has three separate code paths
- **Files**: `packages/parser/src/pdf/index.ts`, `llm-fallback.ts`, web-side `pdf.ts`
- **Issue**: Structured parse, fallback line scanner, and LLM fallback are three independent implementations. Maintenance burden tripled.
- **Fix**: Unify common extraction logic into shared post-processing pipeline.

### F-CRI-07 [MEDIUM] No automated card rule validation pipeline
- **Files**: `packages/rules/data/cards/`
- **Issue**: YAML card rules are hand-edited with no CI validation beyond Zod parse. Inconsistent formatting, missing fields, stale data possible.
- **Fix**: Add `bun run validate-rules` to CI.

### F-CRI-08 [MEDIUM] Store persistence uses sessionStorage with no eviction
- **File**: `apps/web/src/lib/store.svelte.ts`
- **Issue**: Analysis results persisted to sessionStorage indefinitely. Large datasets could exceed 5MB quota.
- **Fix**: Add size check and graceful degradation.

## Recommendations
1. Create `packages/shared/` for isomorphic parser utilities
2. Add deferred-fix tracker as markdown table in `.context/`
3. Extract post-processing pipeline from all three PDF paths
