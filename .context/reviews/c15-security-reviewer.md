# Cycle 15 — Security Review

**Date:** 2026-05-06
**Scope:** Security review of packages/parser/, apps/web/src/lib/parser/, apps/web/src/components/, and packages/viz/src/report/.

## Verified Safe
- HTML report generator (`packages/viz/src/report/generator.ts`) properly escapes all dynamic content via `esc()` function before interpolation.
- No `eval()`, `Function()`, `innerHTML`, or `document.write` patterns found in web source.
- No `any` types in core/parser packages (TypeScript strictness is good).

## Findings

### C15-SEC01: OFX extractTag uses dynamic RegExp with hardcoded tag names (LOW)
- **File:** `packages/parser/src/ofx/index.ts:59-66`
- **Issue:** `extractTag` constructs regexes via `new RegExp(\`<${tagName}...\`)`. The tagName parameter is hardcoded in all call sites ('DTPOSTED', 'TRNAMT', 'NAME', 'MEMO', 'TRNTYPE'), so this is NOT attacker-controlled in practice. However, if the function is ever called with a user-derived tagName, it becomes a regex injection vector.
- **Fix:** Add input validation to `extractTag`: assert that `tagName` matches `/^[A-Z][A-Z0-9]*$/` (valid OFX tag name pattern) before constructing the regex.
- **Confidence:** Low

### C15-SEC02: FileDropzone accepted file types include HTML (LOW)
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:97-106`
- **Issue:** HTML files are accepted (`text/html`, `.html`, `.htm`). While the HTML parser processes them client-side, uploading arbitrary HTML files could be a social engineering vector (user uploads a crafted HTML file thinking it's a statement).
- **Mitigation:** The parser runs entirely client-side, so no server-side XSS risk. The HTML content is parsed as table data, not rendered. Risk is limited to UI confusion.
- **Confidence:** Low

### C15-SEC03: CSP still uses unsafe-inline in script-src (MEDIUM — carry-over)
- **File:** `apps/web/src/layouts/Layout.astro:46`
- **Issue:** The CSP TODO comment indicates `unsafe-inline` is still in use for script-src. This is a known deferred item (D7-M13).
- **Status:** Already deferred. No new information.
- **Confidence:** High

## No New Critical/High Security Issues Found
