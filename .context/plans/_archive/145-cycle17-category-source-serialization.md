# Plan 145: Cycle 17 Category Source Serialization

**Finding:** C17-002 (Medium/High)
**Status:** completed
**Deploy mode:** none
**Archived:** 2026-07-24 after Cycle 18 verification

## Evidence

- Category IDs and labels are ordinary strings at
  `packages/rules/src/schema.ts:303-335`.
- `scripts/build-json.ts:448-463` currently interpolates those values inside
  handwritten single-quoted TypeScript literals.
- JSON catalog projections already use structured serialization, but the
  generated executable fallback at
  `apps/web/src/lib/category-labels-fallback.ts` does not.
- The checked-in taxonomy is benign; the defect is at the active
  repository-authoring and regeneration boundary.

## Implementation

1. Extract a small pure generator helper that projects roots and first-level
   subcategories into the existing ordered key/label tuple contract.
2. Serialize the complete tuple array with `JSON.stringify`; do not
   interpolate an individual ID or label into executable syntax.
3. Escape JavaScript line-separator code points if necessary after structured
   serialization and embed only the serialized data in a fixed TypeScript
   module template.
4. Preserve bare subcategory aliases, qualified aliases, insertion order,
   duplicate-key `Map` behavior, generated header, and exported symbol name.
5. Add pure regression fixtures containing apostrophes, backslashes,
   newlines, Unicode U+2028/U+2029 separators, template-marker text,
   closing-tag-like text, and non-ASCII labels.
6. Compile or evaluate the emitted module in the regression and assert an
   exact `Map` round trip for every fixture key and label.
7. Regenerate the checked-in fallback through the canonical data build and
   retain no hand-edited generated output.

## Acceptance

- [x] Authored category strings never cross a handwritten source-code
      delimiter.
- [x] Generated TypeScript parses and type-checks for all source-significant
      fixtures.
- [x] The evaluated map exactly preserves keys, labels, alias rules, and
      order.
- [x] Current catalog behavior and generated-data checks remain unchanged
      except for deterministic safe serialization.
- [x] The helper is generator-owned and does not add runtime browser weight.

## Completion evidence

The requested `ralph` capability was unavailable, so Prompt 3 used the
approved disciplined manual fallback. Category tuple projection and module
generation now live in `scripts/category-label-publication.ts`. The complete
tuple array crosses `JSON.stringify` once, U+2028/U+2029 are escaped, and only
the serialized data enters a fixed module template.

The focused regression passed with eight expectations. Its generated module
passed TypeScript semantic diagnostics and evaluation from a JavaScript data
module while preserving quotes, slashes, line breaks, Unicode separators,
template-marker text, closing-tag-like text, bare and qualified aliases,
insertion order, and duplicate-key `Map` semantics. Canonical generation and
drift checking passed.

## Verification

Run the new pure generator regression, `bun run data:build`, and
`bun run data:check`, then run:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run test:bun`
- `bunx vitest run`
- `bun run test:e2e`

Use the repository E2E ownership preflight and postflight checks. Do not
deploy.
