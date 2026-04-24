# Cycle 10 — Security Reviewer

Date: 2026-04-24

## Inventory of reviewed files

All source files in `packages/`, `apps/web/src/`, and configuration files.

## Findings

### C10-S01: CSP 'unsafe-inline' in script-src
- **File+line:** `apps/web/src/layouts/Layout.astro:46` (TODO comment)
- **Description:** Same as D7-M13. The inline script is required by Astro's hydration mechanism. Nonce-based CSP requires upstream Astro support.
- **Confidence:** High
- **Status:** ALREADY TRACKED (D7-M13)

### C10-S02: No Subresource Integrity on external script
- **File+line:** `apps/web/src/layouts/Layout.astro:53`
- **Description:** Same as D-32. The `is:inline` attribute ensures the script is embedded from the same origin. SRI would only matter if loaded from a CDN.
- **Confidence:** Medium
- **Status:** ALREADY TRACKED (D-32)

### C10-S03: SessionStorage parse errors silently swallowed
- **File+line:** `apps/web/src/lib/store.svelte.ts:318`
- **Description:** Same as D-31. The catch block removes corrupted data, which is the correct recovery behavior. Adding console.warn would help debugging but isn't critical.
- **Confidence:** Medium
- **Status:** ALREADY TRACKED (D-31)

## Sweep for commonly missed issues

1. **XSS vectors:** All user-provided data (merchant names, category labels) is rendered via Svelte's default text interpolation (`{variable}`), which auto-escapes HTML. No raw HTML injection (`{@html}`) is used with user data. The only `style=` attributes use computed values from hardcoded color maps, not user input.

2. **Secrets/credentials:** No API keys, tokens, or credentials found in source code. The Claude API key for the scraper tool is expected to be in environment variables.

3. **Input validation in parsers:** CSV/XLSX/PDF parsers properly handle malformed input with try/catch. The `isOptimizableTx` function in store.svelte.ts validates transaction fields before use.

4. **Prototype pollution:** `JSON.parse` results are typed as specific interfaces. No `Object.assign({}, userInput)` patterns that could pollute prototypes.

5. **Authentication/authorization:** This is a client-side-only application with no user authentication. All data stays in the browser's sessionStorage. No server-side attack surface.

6. **Fetch security:** All fetches use relative URLs (`${getBaseUrl()}data/cards.json`), preventing SSRF. AbortController and AbortSignal properly chain external signals to internal controllers.

## Conclusion

Zero net-new security findings. All known security items (CSP, SRI, sessionStorage handling) are tracked in deferred items. The application has minimal attack surface due to its client-side-only architecture.
