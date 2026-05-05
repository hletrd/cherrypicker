# Document Specialist — Cycle 4 Findings

## Summary
5 findings on documentation completeness and API contracts. 1 critical, 2 high, 2 medium.

## Findings

### F-DOC-01 [CRITICAL] No API contract between parser and optimizer
- **Files**: `packages/parser/src/types.ts` vs `packages/core/src/models/transaction.ts`
- **Issue**: `RawTransaction` (parser output) and `Transaction` (optimizer input) are separate types with no documented mapping. Fields like `installments` exist in one but not the other with unclear semantics.
- **Fix**: Document transformation pipeline: `RawTransaction → Transaction → CategorizedTransaction`.

### F-DOC-02 [HIGH] Card rule YAML schema undocumented
- **Files**: `packages/rules/data/cards/*.yaml`
- **Issue**: No human-readable documentation of what fields are available, what `condition.type` values exist, or how caps work.
- **Fix**: Add `RULES_SCHEMA.md` with examples for each rule type.

### F-DOC-03 [HIGH] No architecture documentation
- **Files**: Entire repo
- **Issue**: No `ARCHITECTURE.md` or `CONTRIBUTING.md`. New developers must reverse-engineer package boundaries.
- **Fix**: Create `ARCHITECTURE.md` with package diagram and data flow.

### F-DOC-04 [MEDIUM] LLM fallback behavior undocumented
- **File**: `packages/parser/src/pdf/llm-fallback.ts`
- **Issue**: No docs explain when LLM fallback triggers, what model is used, cost implications, or rate limits.
- **Fix**: Add section to `packages/parser/README.md`.

### F-DOC-05 [MEDIUM] Environment variables undocumented
- **Files**: `tools/scraper/`, `packages/parser/`
- **Issue**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` mentioned in code but not in README.
- **Fix**: Add `.env.example` and document all env vars.

## Recommendations
1. Create `ARCHITECTURE.md` at repo root
2. Add `RULES_SCHEMA.md` in `packages/rules/`
3. Add `.env.example` files in all tool packages
4. Generate API docs from TypeScript types
