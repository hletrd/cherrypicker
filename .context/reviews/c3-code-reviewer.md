# Cycle 3 — Code Reviewer

**Date:** 2026-04-24
**Reviewer:** code-reviewer
**Scope:** Full repository

---

## C3-CR01: Duplicate keyword entry `SHAKE SHACK KOREA` across keyword files

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/keywords.ts:9187`, `packages/core/src/categorizer/keywords-english.ts:108`
- **Description:** The merchant keyword `'SHAKE SHACK KOREA'` appears in both `keywords.ts` (MERCHANT_KEYWORDS) and `keywords-english.ts` (ENGLISH_KEYWORDS), both mapped to `'dining.fast_food'`. The `ALL_KEYWORDS` map in `matcher.ts` merges all four keyword files with spread operators (`{...MERCHANT_KEYWORDS, ...ENGLISH_KEYWORDS, ...NICHE_KEYWORDS, ...LOCATION_KEYWORDS}`). Since later spreads overwrite earlier ones for duplicate keys, the ENGLISH_KEYWORDS entry silently overwrites the MERCHANT_KEYWORDS entry. While the values are identical today, this creates a maintenance hazard: if either entry's category is changed, the other becomes a shadowed dead entry that appears to be active but is never reached.
- **Failure scenario:** A developer changes `keywords.ts`'s `SHAKE SHACK KOREA` entry to `'dining.restaurant'` but doesn't update the duplicate in `keywords-english.ts`. The ENGLISH_KEYWORDS entry silently overwrites, and the categorizer still matches `dining.fast_food` instead of the intended `dining.restaurant`.
- **Fix:** Remove the duplicate from `keywords-english.ts` and add a comment in `keywords.ts` noting that SHAKE SHACK KOREA is also covered there. Alternatively, establish a convention that ENGLISH_KEYWORDS should not contain entries that also exist in MERCHANT_KEYWORDS.

## C3-CR02: `calculateRewards` bucket object created via `??` on undefined Map.get returns mutable default

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `packages/core/src/calculator/reward.ts:232-243`
- **Description:** The bucket creation pattern `categoryRewards.get(categoryKey) ?? { category: categoryKey, ... }` creates a new object literal on cache miss. If `categoryRewards.set(categoryKey, bucket)` is NOT called on the next line (e.g., the `continue` at line 248 skips it when `!rule`), the bucket IS still set via the `continue` path on line 247-248. However, when the rule IS found, there's a subtle ordering issue: `bucket.spending += tx.amount` at line 244 mutates the object before the `set()` call, meaning the mutation happens on an un-tracked object. This works correctly in practice because JavaScript's reference semantics mean `set()` will store the already-mutated object. But this pattern is fragile: if a future developer adds an early return between the mutation and the `set()`, the mutated bucket would be lost.
- **Failure scenario:** Future refactor adds a condition that returns early between `bucket.spending += tx.amount` and `categoryRewards.set()`, causing spending totals to be lost for categories where the rule is found.
- **Fix:** Move `categoryRewards.set(categoryKey, bucket)` immediately after bucket creation (before the spending mutation), or use a `getOrCreate` helper that always sets on first access.

## C3-CR03: `TransactionReview.svelte` FALLBACK_GROUPS and FALLBACK_CATEGORIES duplicate entries from FALLBACK_CATEGORY_LABELS

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-46`, `apps/web/src/lib/category-labels.ts:32-110`
- **Description:** `FALLBACK_GROUPS` in TransactionReview and `FALLBACK_CATEGORY_LABELS` in category-labels.ts are two independent hardcoded fallback maps that must be kept in sync with the taxonomy. This is the same class of issue as C2-01 (three independent hardcoded maps). While C2-01 addressed `CATEGORY_NAMES_KO` and `FALLBACK_CATEGORY_LABELS`, `FALLBACK_GROUPS` adds a fourth independent map. The divergence risk is real: `FALLBACK_GROUPS` includes `convenience_store` as a standalone group (line 29) but `FALLBACK_CATEGORY_LABELS` has it as a child of `grocery` (line 42). The taxonomy has `convenience_store` as a subcategory of `grocery`.
- **Failure scenario:** When categories.json fails to load, TransactionReview shows `convenience_store` as a top-level group, while CardDetail and CategoryBreakdown show it under `grocery`. The user sees inconsistent category hierarchy.
- **Fix:** Either derive FALLBACK_GROUPS from FALLBACK_CATEGORY_LABELS programmatically, or ensure both are generated from the same source (the taxonomy YAML).

## C3-CR04: `OptimalCardMap.svelte` table headers missing `scope="col"` for WCAG 1.3.1

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:81-86`
- **Description:** The OptimalCardMap table's `<th>` elements do not have `scope="col"` attributes, unlike CardDetail.svelte which was fixed in C2-05. The SavingsComparison breakdown table (line 279-283) and ReportContent tables also lack `scope="col"`. This is a WCAG 1.3.1 accessibility issue that screen readers need to correctly associate header cells with data cells.
- **Failure scenario:** Screen reader users navigating the OptimalCardMap table cannot determine which column a cell belongs to, since the headers are not programmatically associated.
- **Fix:** Add `scope="col"` to all `<th>` elements in OptimalCardMap, SavingsComparison breakdown table, and ReportContent tables.

## C3-CR05: `ReportContent.svelte` uses `import.meta.env.BASE_URL` instead of `buildPageUrl` for navigation links

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/report/ReportContent.svelte:138`
- **Description:** The "명세서 올리러 가기" link in the ReportContent empty state uses `href={import.meta.env.BASE_URL ?? '/'}` directly, while the same link in CategoryBreakdown (line 279) and OptimalCardMap (line 176) also use the raw BASE_URL. The `buildPageUrl()` helper in formatters.ts handles BASE_URL with or without a trailing slash, but these components don't use it. If BASE_URL is something like `/cherrypicker` (without trailing slash), the link becomes `/cherrypicker` which is correct. But if it's `/cherrypicker/`, the link becomes `/cherrypicker/` which is also correct. The issue is inconsistency: some navigation uses `buildPageUrl()` (FileDropzone, CardDetail) while others use raw `BASE_URL`.
- **Failure scenario:** A developer changes BASE_URL format, and navigation links break in some components but not others.
- **Fix:** Use `buildPageUrl('')` or `buildPageUrl('/')` consistently across all navigation links.

---

## Final Sweep

Reviewed all source files in:
- `packages/core/src/` (optimizer, calculator, categorizer, models)
- `packages/parser/src/` (csv, pdf, xlsx, detect)
- `packages/rules/src/` (schema, loader, category-names)
- `packages/viz/src/` (report, terminal)
- `apps/web/src/` (store, analyzer, formatters, cards, category-labels, parser, all components)
- `tools/cli/src/` and `tools/scraper/src/`

No security, correctness, or data-loss findings in this cycle.
