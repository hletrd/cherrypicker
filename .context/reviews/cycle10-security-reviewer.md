# Cycle 10 — security-reviewer

## Scope
- CSP (Layout.astro, e2e CSP assertions).
- XSS surfaces: user-controlled merchant/category rendering in dashboard components.
- sessionStorage/localStorage handling (quota errors, corruption, version migrations in `store.svelte.ts`).
- File upload path (validation, size limits).
- Subresource integrity on external scripts (D-32).

## Findings

### S10-00 — No net-new security findings [High]
- CSP still uses `script-src 'unsafe-inline'` (Layout.astro:42). Constraint documented at :30-40: Astro injects inline hydration scripts; Tailwind v4 requires inline styles. D7-M13 exit criterion (Astro nonce migration) still a blocker — upstream Astro issue. Severity MEDIUM/High unchanged.
- File upload validation: extension + MIME checks (FileDropzone.svelte:118-121), 10 MB per-file cap + 50 MB total cap (:123-124, :132, :158). No change cycle-over-cycle.
- sessionStorage version migration path is safe: schema version gate (store.svelte.ts:234-251), migrations run before validation (:248-251), corrupted-data removal in catch (:318-327). No injection vectors.
- No external CDN scripts to SRI — D-32 exit criterion (external CDN script loaded) not triggered.
- Merchant text rendering — Svelte auto-escapes `{merchant}` interpolations in dashboard; no `{@html}` tags in rendering paths (verified via grep).

## Confidence
High. Security posture unchanged from cycle 9.
