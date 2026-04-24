# Code Reviewer — Cycle 1 (Fresh Review 2026-04-24)

## Inventory of Reviewed Files

- `apps/web/src/lib/store.svelte.ts` — State management
- `apps/web/src/lib/analyzer.ts` — Analysis orchestration
- `apps/web/src/lib/cards.ts` — Card data loading
- `apps/web/src/lib/formatters.ts` — Formatting utilities
- `apps/web/src/lib/parser/csv.ts` — CSV parser
- `apps/web/src/lib/parser/xlsx.ts` — XLSX parser
- `apps/web/src/lib/parser/pdf.ts` — PDF parser
- `apps/web/src/lib/parser/detect.ts` — Bank detection
- `apps/web/src/lib/parser/date-utils.ts` — Date utilities
- `packages/core/src/calculator/reward.ts` — Reward calculator
- `packages/core/src/optimizer/greedy.ts` — Greedy optimizer
- `packages/core/src/categorizer/matcher.ts` — Merchant matcher
- `packages/rules/src/schema.ts` — Zod schemas

## New Findings

### C1-01: CardDetail `loadCategories` abort produces raw category IDs
- **File:** `apps/web/src/components/cards/CardDetail.svelte:28-38`
- **Severity:** MEDIUM
- **Confidence:** High
- **Description:** When `loadCategories(controller.signal)` is aborted (e.g., Astro View Transition), it returns `[]`. CardDetail then builds an empty `categoryLabels` map and sets `categoryLabelsReady = true`. The rewards table renders with raw English category IDs (e.g., "dining.cafe") instead of Korean labels. TransactionReview handles this with a hardcoded fallback; CardDetail does not.
- **Fix:** Check `if (nodes.length === 0)` after `loadCategories()` and skip setting `categoryLabelsReady = true` or use a hardcoded fallback map.

### C1-02: Server-side `detectCSVDelimiter` scans all lines — unlike web version
- **File:** `packages/parser/src/detect.ts:148-165`
- **Severity:** LOW
- **Confidence:** High
- **Description:** The server-side `detectCSVDelimiter` processes all lines in the content, while the web-side version (`apps/web/src/lib/parser/detect.ts:171-191`) limits to the first 30 lines (C83-05). For large CSV files, the server version does an unnecessary O(n) scan.
- **Fix:** Add `.slice(0, 30)` to the lines array in the server version.

### C1-03: `toCoreCardRuleSets` silently falls back unknown sources to 'web'
- **File:** `apps/web/src/lib/analyzer.ts:55-58`
- **Severity:** LOW
- **Confidence:** Medium
- **Description:** When a card's `source` is not in `VALID_SOURCES`, the adapter silently falls back to `'web'`. This is misleading for scraped cards. A warning should be logged. Same issue applies to unknown reward types falling back to `'discount'`.
- **Fix:** Log a `console.warn` when a fallback is applied.

## Previously Deferred (Acknowledged, Not Re-reported)

All items in `.context/plans/00-deferred-items.md` (D-01 through D-111) remain valid. No regression or new evidence found for any deferred item.
