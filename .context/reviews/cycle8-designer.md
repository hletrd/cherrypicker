# Cycle 8 — designer

## Inventory

UI components:
- `apps/web/src/components/upload/FileDropzone.svelte`
- `apps/web/src/components/dashboard/*.svelte`
- `apps/web/src/layouts/Layout.astro`
- `apps/web/src/pages/*.astro`

## Re-audit of cycle-6/7 UI fixes

Verified statically:
- `FileDropzone.svelte` stepper uses `<ol><li aria-current="step">` (line 312+). C6UI-02 resolved.
- Bank pills have `aria-pressed` (P1-09 via grep). Resolved.
- `beforeunload` guard installed only during upload (lines 261, 295). Resolved.
- Feature cards have `data-testid="feature-card-{analysis,recommend,savings}"` (C7-E03). Resolved.
- `input type="number"` with `max="10000000000"` clamp (P1-04). Resolved.

## Re-audit of D7-M10 (spinner missing `aria-busy`)

Confirmed: at `FileDropzone.svelte` the upload form container does NOT set `aria-busy`. Screen readers don't announce loading state — only visual users see the spinner.

Fix: add `aria-busy={uploadStatus === 'uploading'}` on the form/dropzone wrapper. 1-line.

Severity: LOW / Medium. Real a11y impact for non-visual users. **Actionable this cycle.**

## New findings

### D8-01 — No `prefers-reduced-motion` handling for upload spinner (LOW / Low)

- File: `FileDropzone.svelte` spinner SVG uses CSS animation.
- Observation: no `@media (prefers-reduced-motion: reduce)` rule to disable animation.
- Severity: LOW. WCAG 2.3.3 AAA. 3-5 line fix.
- Recommendation: defer to a11y cycle alongside D7-M8.

### D8-02 — Dashboard cards lack `role="region"` + `aria-label` for landmark navigation (LOW / Low)

- File: `apps/web/src/components/dashboard/*.svelte`
- Observation: each dashboard card is a `<section>` but without `aria-labelledby` pointing to its heading.
- Recommendation: defer to a11y cycle. Current AA-conformant.

### D8-03 — `Layout.astro` base tag interaction with routing (NOT A BUG)

- `<base href={base} />` at line 28. Combined with Astro client-side navigation at `FileDropzone.svelte:281`, verifies relative URLs resolve correctly under the `/cherrypicker/` base.
- Tested by existing e2e. No action.

## Actionable

- Land D7-M10 aria-busy fix this cycle.
- Remaining designer findings (D8-01, D8-02) defer to a11y cycle (D7-M8 gate).
