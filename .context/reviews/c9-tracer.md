# Cycle 9 — Tracer

## C9-T01: Hardcoded duplicate propagation trace
- **Trace:** categories.yaml → build-time JSON → categories.json → runtime loadCategories() → CategoryNode[] → buildCategoryLabelMap() → Map<string, string>
- **Divergence points:**
  1. CATEGORY_NAMES_KO (greedy.ts) — written by hand, never regenerated
  2. FALLBACK_CATEGORY_LABELS (category-labels.ts) — written by hand, never regenerated
  3. FALLBACK_GROUPS (TransactionReview.svelte) — written by hand, never regenerated
  4. CATEGORY_COLORS (CategoryBreakdown.svelte) — written by hand, never regenerated
  5. formatIssuerNameKo (formatters.ts) — written by hand, never regenerated
  6. getCategoryIconName (formatters.ts) — written by hand, never regenerated
  7. getIssuerColor (formatters.ts) — written by hand, never regenerated
- **Root cause:** No build-time code generation from the YAML/JSON source data. Every display attribute (label, color, icon) that maps from a taxonomy ID is manually maintained.
- **Fix:** Single build-time script that reads YAML and JSON sources and generates all 7 maps as TypeScript modules.

## C9-T02: Bank list duplication trace
- **Source:** packages/parser/src/detect.ts → BANK_SIGNATURES[]
- **Duplicate:** apps/web/src/components/upload/FileDropzone.svelte → ALL_BANKS[]
- **Divergence risk:** New bank added to parser but not to UI selector.
