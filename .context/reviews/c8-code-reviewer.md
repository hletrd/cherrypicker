# Cycle 8 — Code Reviewer

**Date:** 2026-04-24
**Reviewer:** code-reviewer
**Scope:** Full repository (apps/web/src/, packages/, tools/)

---

## C8-CR01: `calculateRewards` bucket mutation via `??` creates object before `set()`

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `packages/core/src/calculator/reward.ts:232-248`
- **Description:** The `categoryRewards.get(categoryKey) ?? { ... }` pattern at line 232-242 creates a new bucket object on the very first access. The bucket is then mutated (lines 244, 329, etc.) before `categoryRewards.set(categoryKey, bucket)` is called at line 248 or 348. In JavaScript's single-threaded execution, this works because no other code can observe the intermediate state. However, this is a fragile pattern: if a future developer adds an early return or error throw between the `??` creation and the `.set()`, the Map would contain a partially-mutated bucket that was never formally registered. The `continue` at line 248 (when `!rule`) sets the bucket but skips reward accumulation, which is correct. The `set` at line 348 covers the reward path. But the gap between creation and first `set` (lines 244-248) means `bucket.spending` could be incremented on a bucket that is not yet in the Map.

- **Failure scenario:** No failure in current code due to JS single-threading. The risk is during future maintenance — a developer adding logic between lines 244 and 248 that depends on the bucket being in the Map would get undefined.

- **Fix:** Move the `categoryRewards.set(categoryKey, bucket)` call immediately after the `??` creation (before `bucket.spending += tx.amount`). This is a defensive ordering improvement, not a bug fix.

## C8-CR02: `TransactionReview.svelte` FALLBACK_GROUPS duplicates category taxonomy for the third time

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-42`
- **Description:** `FALLBACK_GROUPS` is a 16-entry hardcoded array that duplicates the category hierarchy from `categories.yaml`. This is the same drift risk as C7-01 (CATEGORY_NAMES_KO) and C7-02 (FALLBACK_CATEGORY_LABELS) but in a third location. The `FALLBACK_CATEGORIES` at line 45 is derived from `FALLBACK_GROUPS`, so there's at least no internal inconsistency. However, any addition to the taxonomy (e.g., adding `pet_care`) requires updating three separate hardcoded locations: `greedy.ts`, `category-labels.ts`, and now `TransactionReview.svelte`.

- **Failure scenario:** A new category is added to `categories.yaml`. The dropdown works when categories load from the network, but on AbortError fallback, the new category is missing from the dropdown, preventing the user from manually assigning it.

- **Fix:** Generate fallback data at build time from the same YAML source, or consolidate all three fallback maps into a single shared module.

---

## Final Sweep

Reviewed all source files in:
- `packages/core/src/` (optimizer, calculator, categorizer, models)
- `packages/parser/src/` (csv, pdf, xlsx, detect, date-utils)
- `packages/rules/src/` (schema, loader, category-names)
- `packages/viz/src/` (report, terminal)
- `apps/web/src/` (store, analyzer, formatters, cards, category-labels, parser, all components, all pages, layout)
- `tools/cli/src/` and `tools/scraper/src/`

All previously identified HIGH and MEDIUM findings have been either fixed or properly deferred with exit criteria. The codebase has reached a high level of maturity. The remaining findings are LOW severity and relate to the recurring pattern of hardcoded taxonomy duplicates (C7-01/C7-02/C8-CR02).

No security, correctness, or data-loss findings beyond what is reported above and in prior deferred items.
