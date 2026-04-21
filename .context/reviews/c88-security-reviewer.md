# Security Reviewer — Cycle 88

## Summary
Full security review focusing on OWASP top 10, secrets, unsafe patterns, auth/authz.

## Findings

### No NEW security findings this cycle

### Verified Security Controls
1. **CSP Policy** (`Layout.astro:42`): Properly configured with `default-src 'self'`, `connect-src 'self'`. `unsafe-inline` required for Astro hydration (documented with TODO for nonce-based migration). No change needed.
2. **No secrets in source**: No API keys, tokens, or credentials found in source files. Claude API usage is server-side only (tools/scraper) and uses environment variables.
3. **Input validation**: Parser modules (csv.ts, xlsx.ts, pdf.ts) validate dates, amounts, and header rows before processing. Malformed data returns errors, not crashes.
4. **XSS prevention**: Svelte 5 auto-escapes template expressions. No `@html` directives found in user-facing components. Style injection via `style="background-color: {color}"` uses only trusted internal color maps (CATEGORY_COLORS, getIssuerColor), not user input.
5. **Session storage**: Data persisted to sessionStorage (not localStorage), cleared on tab close. No sensitive PII stored -- only spending amounts and card names.
6. **Fetch security**: All fetch calls use `'self'` origin (same-origin). No external API calls from the web app.

### Carried-Forward Security Notes
- CSP `unsafe-inline` remains a known limitation (documented in Layout.astro comment). Not actionable until Astro supports nonce-based CSP.
