# Plan 119 — Cycle 9 Decorative SVG Semantics

**Finding:** C9-011 (Low/High)
**Status:** completed
**Deploy mode:** none

## Evidence

The live accessibility tree exposes unnamed image nodes for inline SVGs in
upload progress/success/error/actions and the card-detail external-link glyph.
Adjacent text and control names already communicate all meaning.

## Outcome

Decorative inline graphics are absent from the accessibility tree while
existing text, statuses, alerts, and link names remain authoritative.

## Implementation

1. Add `aria-hidden="true"` and `focusable="false"` to each decorative inline
   SVG in `FileDropzone.svelte` and `CardDetail.svelte`.
2. Keep any future meaning-bearing graphic named explicitly rather than
   applying the decorative contract indiscriminately.
3. Add a source/component accessibility regression covering upload states and
   the external-link control, and require no unnamed image nodes.

## Acceptance

- [x] Upload and card-detail decorative SVGs are hidden from assistive
      technology.
- [x] Visible text, role-alert/status messages, and control accessible names
      remain unchanged.
- [x] Accessibility regressions cover all listed inline SVG sites.

## Execution note

The `ralph` skill is unavailable. Prompt 3 will use a focused markup/test loop
before the complete quality gates and required owned E2E run.

## Completion evidence

- All eight listed decorative SVGs now use `aria-hidden="true"` and
  `focusable="false"` without changing their adjacent accessible text.
- Component regression tests cover every listed site, and the final
  accessibility-sensitive Playwright run passed all 96 tests.
