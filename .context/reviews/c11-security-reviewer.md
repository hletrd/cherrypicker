# Cycle 11 — Security Reviewer

Date: 2026-04-24

## Findings

### No new security findings

The codebase is a client-side-only web application with no server-side API endpoints, no authentication, and no user accounts. The attack surface is minimal:

1. **CSP:** `unsafe-inline` in script-src is a known deferred item (D7-M13). Astro's hydration requires it currently.
2. **No secrets in code:** No API keys, tokens, or credentials found in the codebase.
3. **No user input sent to external servers:** All data processing happens client-side. Card data is fetched from static JSON on the same origin.
4. **sessionStorage:** Data stored locally is not sensitive (financial statement data the user uploaded themselves). The 4MB cap with truncation warning is appropriate.
5. **PDF parsing:** pdfjs-dist is used client-side only. The worker is loaded from a bundled same-origin URL, not a remote CDN.

## Carry-over items

- **D7-M13** — `unsafe-inline` in CSP (MEDIUM, tied to Astro nonce upstream gate)
- **D7-M2** — resolved (was about mutable `_loadPersistWarningKind`, now consumed+reset at store creation)

## Final sweep

All fetch calls use relative URLs to the same origin. No `eval()`, no `innerHTML` without sanitization, no dynamic script injection from user input. The `parseAmount` functions properly reject NaN/null values. No SQL injection vectors (no database). No XSS vectors (Svelte auto-escapes, no `v-html` equivalent).
