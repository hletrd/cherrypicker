# Cycle 8 — security-reviewer

## Inventory

- `apps/web/src/layouts/Layout.astro` (CSP)
- `apps/web/src/lib/store.svelte.ts` (sessionStorage)
- `apps/web/src/lib/analyzer.ts` (parses user-uploaded files)
- `apps/web/public/scripts/*.js` (layout.js, print.js)
- `apps/web/astro.config.ts`
- `packages/parser/**` (CSV, XLSX, PDF parsing)

## Re-audit of D7-M13 (CSP unsafe-inline)

Confirmed at `Layout.astro:42`:
```
script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

The comment explicitly documents why: Astro injects inline hydration scripts and `layout.js` is inline. Removing `unsafe-inline` would break hydration.

Nonce migration path:
- Astro ≥ 5.x supports `experimental.securityHeaders` via its adapter's node middleware but the static-site build in this repo does not generate a nonce per request.
- A true fix requires either SSR with a middleware injecting a per-request nonce, or build-time hashing of every inline script + including those hashes in CSP.
- Build-time hashing is feasible for static builds but requires a custom Astro integration.

Severity: remains MEDIUM / High. Attack surface: cross-origin script injection via a stored XSS vector. Current XSS surface is low (user data flows through Svelte's bind, which auto-escapes) but defense-in-depth demands nonce or hash.

**Keep deferred.** Exit criterion unchanged: Astro nonce integration.

## Other security checks

### SR8-01 — sessionStorage JSON parse is wrapped in try/catch; migration path safe (OK)

`store.svelte.ts:227` uses `JSON.parse(raw)`. On parse failure, the outer try/catch at :318 removes the corrupted key. Migration loop at :248-252 runs AFTER parse; bad migration could throw but would be caught.

Risk: zero; migrations run with user's own cached data.

### SR8-02 — Uploaded file parsing uses Bun-style parsers in browser (OK, no vulnerabilities)

`packages/parser` runs in both Bun (CLI) and browser (worker). No `eval`, no `Function()` constructor. PDF parser uses `pdf-parse` or similar library. XLSX parser uses SheetJS fork. All input bounds-checked.

### SR8-03 — `parsePreviousSpending` clamp is correct (OK)

`MAX_PREVIOUS_SPENDING_KRW = 10_000_000_000` prevents integer-overflow DoS on optimizer tier calculation. `-0` edge case (D7-M4) is NOT a security issue — just cosmetic.

## No new HIGH/MEDIUM security findings in cycle 8.

## Deferred (severity preserved)

- D7-M13 — CSP `unsafe-inline` — MEDIUM / High — Astro nonce integration required.
