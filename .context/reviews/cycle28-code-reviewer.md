# Code Review — Cycle 28

## C28-CR01: Server-side XLSX parser retains local `parseAmount` wrapper after C27 extraction
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts:151-164`

C27-COR03 extracted a shared `parseAmount` to `apps/web/src/lib/parser/amount.ts` on the web side. However, the server-side XLSX parser still defines its own local `parseAmount` wrapper (lines 151-164) that delegates to `parseAmountString`. This wrapper should be shared across all server-side parsers (XLSX, PDF already aliases it, HTML uses `parseAmountString` directly).

**Concrete failure**: Code duplication means future fixes to amount handling (e.g., new format support) must be applied in multiple places. The local wrapper already drifted once — it does not include the `if (!cleaned) return null;` guard present in `parseAmountString`.

**Fix**: Extract `parseAmount` wrapper to `packages/parser/src/amount.ts` and import from there in XLSX, PDF, and other parsers.

## C28-CR02: Missing dedicated server-side `amount.ts` module
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/` (missing `amount.ts`)

The web side has `apps/web/src/lib/parser/amount.ts` as a dedicated module for amount parsing. The server side has `parseAmountString` buried in `packages/parser/src/csv/shared.ts`. For architectural consistency and discoverability, the server side should also have a top-level `amount.ts` module.

**Fix**: Create `packages/parser/src/amount.ts` that exports `parseAmountString` and `parseAmount` (the `unknown`-accepting wrapper), re-exporting from `csv/shared.ts` or containing the logic directly.

## C28-CR03: `normalizeHTML` strips event handlers but not `javascript:` pseudo-protocol URLs
**Severity: Low | Confidence: Medium**
**File**: `apps/web/src/lib/parser/html.ts:29-46`

The `normalizeHTML` function removes `onclick`, `onerror`, and other event handler attributes, but does not strip `href="javascript:..."` or `src="javascript:..."` attributes. While the normalized HTML is passed to SheetJS (not rendered in the DOM), a future change that renders raw HTML could introduce an XSS vulnerability.

**Fix**: Add `.replace(/\s*(href|src)\s*=\s*["']?javascript:[^"'>\s]*/gi, '')` to the normalization chain, or document the security assumption that HTML is never rendered.

## C28-CR04: Web-side PDF fallback scanner uses `dateMatch[0]` while server-side uses `dateMatch[1]`
**Severity: Low | Confidence: High**
**Files**: `apps/web/src/lib/parser/pdf.ts:594`, `packages/parser/src/pdf/index.ts:376`

The fallback date pattern regex has a single capture group wrapping all alternatives. The web-side accesses `dateMatch[0]` (full match) while the server-side accesses `dateMatch[1]` (capture group). They are equivalent for this regex, but the inconsistency is a maintenance risk — if the regex is modified to have different capture groups, one side will break.

**Fix**: Standardize both to use `dateMatch[0]` (the full match), which is more robust against regex changes.
