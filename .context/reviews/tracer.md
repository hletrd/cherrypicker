# Tracer — Cycle 4 Findings

## Summary
5 findings focused on observability, debugging support, and error context. 1 critical, 2 high, 2 medium.

## Findings

### R-TRA-01 [CRITICAL] Parser errors lack file context
- **Files**: All parsers in `packages/parser/src/`
- **Issue**: When a parse fails, error messages do not include filename, format detected, or line number. Debugging requires manual reproduction.
- **Fix**: Wrap all parse errors with `{ file, format, line, raw }` context.

### R-TRA-02 [HIGH] Optimizer gives no insight into assignment decisions
- **File**: `packages/core/src/optimizer/greedy.ts`
- **Issue**: Result only shows final assignment. No trace of why card A was chosen over card B for a given transaction.
- **Fix**: Add optional `trace` array to `OptimizationResult` showing per-transaction marginal scores.

### R-TRA-03 [HIGH] LLM fallback gives no visibility into token usage
- **File**: `packages/parser/src/pdf/llm-fallback.ts`
- **Issue**: No logging of model used, tokens consumed, or truncation applied. Cost debugging impossible.
- **Fix**: Return usage metadata alongside parsed transactions.

### R-TRA-04 [MEDIUM] No structured logging anywhere in the codebase
- **Files**: Entire repo
- **Issue**: Ad-hoc `console.warn`/`console.log` scattered across packages. No unified log level, no correlation IDs.
- **Fix**: Introduce lightweight `Logger` interface: `{ debug, info, warn, error }`.

### R-TRA-05 [MEDIUM] Scraper has no progress indication
- **File**: `tools/scraper/src/extractor.ts`
- **Issue**: Long-running extraction gives no feedback. If it hangs, no way to know where.
- **Fix**: Add progress callbacks or structured logging.

## Recommendations
1. Define `ParseErrorContext` interface and wrap all parser throws
2. Add `trace?: AssignmentTrace[]` to `OptimizationResult`
3. Replace all `console.*` calls with injected logger
4. Add `usage: { inputTokens, outputTokens }` to LLM fallback return
