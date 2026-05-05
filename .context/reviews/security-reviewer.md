# Security Reviewer — Cycle 4 Findings

## Summary
6 findings. 1 critical, 2 high, 3 medium. No active exploits found, but several trust boundary issues.

## Findings

### S-SEC-01 [CRITICAL] LLM fallback exposes API key in server-side bundle
- **File**: `packages/parser/src/pdf/llm-fallback.ts` line 38
- **Issue**: `process.env['ANTHROPIC_API_KEY']` accessed at runtime. If this code is bundled for edge/serverless, the key could leak in build artifacts.
- **Fix**: Add explicit runtime guard, document key rotation policy.

### S-SEC-02 [HIGH] fetcher.ts abort timeout lost on EUC-KR retry
- **File**: `tools/scraper/src/fetcher.ts`
- **Issue**: Abort controller not propagated to second fetch attempt. Hanging connection possible.
- **Fix**: Propagate signal to all fetch invocations.

### S-SEC-03 [HIGH] No input validation on uploaded file size
- **File**: `apps/web/src/components/upload/FileDropzone.svelte`
- **Issue**: No max file size check before parser invocation. Large files can crash tab.
- **Fix**: Add 10MB size limit with user-friendly error.

### S-SEC-04 [MEDIUM] Anthropic API key read from env without validation
- **File**: `tools/scraper/src/extractor.ts` line 21
- **Issue**: `new Anthropic()` with no explicit key falls through to env. No validation that key exists before network call.
- **Fix**: Validate key presence explicitly with clear error.

### S-SEC-05 [MEDIUM] PDF parser regex on untrusted input
- **File**: `packages/parser/src/pdf/index.ts`
- **Issue**: Multiple regexes executed on PDF-extracted text without length limits. ReDoS possible with crafted input.
- **Fix**: Cap input length before regex application.

### S-SEC-06 [MEDIUM] LLM fallback accepts arbitrary model name from env
- **File**: `packages/parser/src/pdf/llm-fallback.ts` line 45
- **Issue**: `process.env['ANTHROPIC_MODEL']` used without validation. Could target non-existent or wrong-cost model.
- **Fix**: Whitelist allowed models.

## Recommendations
1. Add `SECURITY.md` documenting trust boundaries
2. Run `npm audit` and review all dependencies
3. Add Content-Security-Policy headers in Astro app
