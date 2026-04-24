# Security Reviewer — Cycle 1 (Fresh Review 2026-04-24)

## Inventory of Reviewed Files

- `apps/web/src/lib/store.svelte.ts` — sessionStorage persistence, validation
- `apps/web/src/lib/cards.ts` — Fetch with AbortController
- `apps/web/src/lib/api.ts` — API layer
- `apps/web/src/components/upload/FileDropzone.svelte` — File upload
- `apps/web/src/components/cards/CardDetail.svelte` — External link
- `packages/parser/src/csv/index.ts` — Server CSV parsing

## New Findings

None. The codebase is a client-side-only application that processes user-provided files entirely in the browser. The attack surface is minimal:

1. **No server-side endpoints** — The app is a static Astro site served from GitHub Pages
2. **sessionStorage** — Same-origin, no cross-site risk; validation is defensive
3. **Card data** — Loaded from same-origin static JSON; no user-generated content
4. **File upload** — Uses `File` API; no path traversal; file size limits enforced
5. **External links** — CardDetail uses `rel="noopener noreferrer"` on external card URLs

## Previously Deferred (Acknowledged)

D7-M13 (`unsafe-inline` in CSP), D-32 (no SRI on external script), D7-M8 (no axe-core gate).
