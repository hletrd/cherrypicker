# Security Review — Cycle 28

## C28-SEC01: `normalizeHTML` does not sanitize `javascript:` URLs
**Severity: Low | Confidence: Medium**
**File**: `apps/web/src/lib/parser/html.ts:29-46`

The `normalizeHTML` function strips event handlers (`onclick`, `onerror`, etc.) and dangerous tags (`script`, `iframe`, `object`, `embed`), but does not remove `javascript:` pseudo-protocol URLs from `href` or `src` attributes.

**Current mitigation**: The normalized HTML is passed to SheetJS (`xlsx.read`) for table extraction, not inserted into the DOM. This limits the exploitability.

**Risk**: If a future change renders the raw HTML (e.g., for a preview feature), `javascript:` URLs could execute arbitrary code. Defense-in-depth suggests sanitizing them now.

**Fix**: Add `.replace(/\s*(href|src)\s*=\s*["']?javascript:[^"'>\s]*/gi, '')` to the normalization chain.

## C28-SEC02: PDF text extraction has no configurable size limit
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/extractor.ts` (not examined in detail)

This is a carry-over from earlier reviews. PDF text extraction reads the entire file into memory. A maliciously large PDF could cause OOM.

**Status**: Known issue, deferred in previous cycles. Exit criterion: add a configurable max file size check before extraction.
