# Architect — Cycle 1 (Fresh Review 2026-04-24)

## Inventory of Reviewed Files

- `apps/web/src/lib/store.svelte.ts` — State management
- `apps/web/src/lib/analyzer.ts` — Analysis orchestration
- `apps/web/src/lib/cards.ts` — Card data loading
- `packages/core/src/optimizer/greedy.ts` — Greedy optimizer, CATEGORY_NAMES_KO
- `packages/parser/src/detect.ts` — Server bank detection
- `apps/web/src/lib/parser/detect.ts` — Web bank detection
- `packages/rules/src/schema.ts` — Zod schemas

## New Findings

### A1-01: `CATEGORY_NAMES_KO` in greedy.ts is a hardcoded duplicate of taxonomy data
- **File:** `packages/core/src/optimizer/greedy.ts:11-86`
- **Severity:** MEDIUM
- **Confidence:** High
- **Description:** The `CATEGORY_NAMES_KO` constant duplicates category taxonomy data from `packages/rules/data/categories.yaml`. The core package's `greedyOptimize` already accepts `categoryLabels?: Map<string, string>` in its constraints, making this constant redundant when labels are provided. When labels are NOT provided (CLI/standalone usage), this hardcoded map is the only source — but it can silently drift from the YAML taxonomy. The existing TODO at line 8-10 acknowledges this. The map is also missing some newer taxonomy entries (e.g., `travel_agency`, `apartment_mgmt`).
- **Fix:** Import category labels from `@cherrypicker/rules` at the package boundary, or require `categoryLabels` to always be provided.

### A1-02: Web and server parser `detectCSVDelimiter` implementations diverged
- **File:** `packages/parser/src/detect.ts:148-165` vs `apps/web/src/lib/parser/detect.ts:171-191`
- **Severity:** LOW
- **Confidence:** High
- **Description:** Same as C1-02/P1-02. The web version limits to 30 lines; the server version does not. This is a concrete divergence in the D-01 duplicate parser class.

## Previously Deferred (Acknowledged)

D-01 (duplicate parser implementations), D-34 (analyzer coupling), D-35/D-55 (inferYear duplication), D-57 (BANK_SIGNATURES duplication), D7-M11 (persistence refactor).
