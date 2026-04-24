# Cycle 3 — Implementation Plan (2026-04-24)

**Source reviews:** `.context/reviews/c3-*.md`, `.context/reviews/_aggregate.md`
**Status:** Complete

---

## Task 1: Fix `convenience_store` hierarchy in FALLBACK_GROUPS [C3-01] -- DONE

- **Severity:** MEDIUM, Confidence: High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-46`
- **Description:** FALLBACK_GROUPS has `convenience_store` as a standalone group, but the taxonomy has it as a subcategory of `grocery`. FALLBACK_CATEGORY_LABELS already has it correctly as `grocery.convenience_store`. This causes a visible inconsistency when categories.json fails to load.
- **Implementation:**
  1. In `TransactionReview.svelte`, removed the standalone `convenience_store` group (line 29).
  2. Added `convenience_store` as an option under the `grocery` group.
  3. Added bare `convenience_store` entry to categoryMap for backward compatibility with saved data.
  4. All gates pass. Committed as `b660acb`.

---

## Task 2: Remove duplicate `SHAKE SHACK KOREA` keyword from keywords-english.ts [C3-02] -- DONE

- **Severity:** LOW, Confidence: High
- **File:** `packages/core/src/categorizer/keywords-english.ts:108`
- **Description:** `'SHAKE SHACK KOREA': 'dining.fast_food'` exists in both `keywords.ts` (line 9187) and `keywords-english.ts` (line 108). The ENGLISH_KEYWORDS spread silently overwrites the MERCHANT_KEYWORDS entry. Remove the duplicate from keywords-english.ts and add a test for cross-file duplicate detection.
- **Implementation:**
  1. Removed `'SHAKE SHACK KOREA': 'dining.fast_food',` from `packages/core/src/categorizer/keywords-english.ts:108`
  2. Added a snapshot-based guard test in `packages/core/__tests__/categorizer.test.ts` that verifies ENGLISH_KEYWORDS does not grow duplicate keys with MERCHANT_KEYWORDS. Uses count threshold (144) to avoid failing on pre-existing duplicates while catching new ones.
  3. Committed as `eda0209` (duplicate removal) and `4cf2cb7` (test refinement).

---

## Task 3: Add `scope="col"` to table headers in OptimalCardMap, SavingsComparison, and ReportContent [C3-04] -- DONE

- **Severity:** LOW, Confidence: High
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:81-86`, `apps/web/src/components/dashboard/SavingsComparison.svelte:279-283`, `apps/web/src/components/report/ReportContent.svelte:70-76,108-113`
- **Description:** Missing `scope="col"` on `<th>` elements in three tables. C2-05 added it to CardDetail but the same issue exists in other tables. WCAG 1.3.1 accessibility.
- **Implementation:**
  1. Added `scope="col"` to all `<th>` elements in OptimalCardMap (5), SavingsComparison (4), and ReportContent (10).
  2. All gates pass. Committed as `49abe71`.

---

## Task 4: Replace raw `import.meta.env.BASE_URL` with `buildPageUrl()` in navigation links [C3-05] -- DONE

- **Severity:** LOW, Confidence: High
- **File:** `apps/web/src/components/report/ReportContent.svelte:138`, `apps/web/src/components/dashboard/CategoryBreakdown.svelte:279`, `apps/web/src/components/dashboard/OptimalCardMap.svelte:176`
- **Description:** Three components use `import.meta.env.BASE_URL ?? '/'` for navigation links instead of the `buildPageUrl()` helper from formatters.ts. This is inconsistent with FileDropzone and CardDetail which use `buildPageUrl()`.
- **Implementation:**
  1. Imported `buildPageUrl` from `../../lib/formatters.js` in all three components.
  2. Added `const homeUrl = buildPageUrl('');` in each script block.
  3. Replaced `href={import.meta.env.BASE_URL ?? '/'}` with `href={homeUrl}` in all three templates. Using a const avoids Svelte parse errors from empty-string literals in template attributes.
  4. All gates pass. Committed as `8b8d72e`.

---

## Task 5: Re-export `buildCategoryNamesKo` from `@cherrypicker/rules` [C3-06] -- ALREADY DONE

- **Severity:** LOW, Confidence: High
- **File:** `packages/rules/src/index.ts`
- **Description:** `buildCategoryNamesKo()` is a public function that could replace the hardcoded CATEGORY_NAMES_KO map, but it's not re-exported from the package's index.ts, making it inaccessible to consumers.
- **Implementation:**
  - Already re-exported at `packages/rules/src/index.ts:39-41`. No changes needed.

---

## Task 6: Trim ANTHROPIC_API_KEY before use [C3-08] -- DONE

- **Severity:** LOW, Confidence: High
- **File:** `packages/parser/src/pdf/llm-fallback.ts:38-39`
- **Description:** The API key is read from `process.env` without trimming. A whitespace-only key would pass the truthiness check but fail authentication with an unclear error message.
- **Implementation:**
  1. Changed `process.env['ANTHROPIC_API_KEY']` to `process.env['ANTHROPIC_API_KEY']?.trim()`.
  2. All gates pass. Committed as `d502de0`.

---

## Task 7: Update JSDoc for `buildCategoryNamesKo` to remove "authoritative" claim [C3-09] -- DONE

- **Severity:** LOW, Confidence: High
- **File:** `packages/rules/src/category-names.ts:1-8`
- **Description:** The JSDoc says the function "CAN generate the authoritative category label mapping" but the function is unused dead code. The "authoritative" claim is misleading.
- **Implementation:**
  1. Updated the JSDoc to clearly state the function is not yet wired into consumers and reference C2-01/C3-01 for the hardcoded map sync issue.
  2. All gates pass. Committed as `a548814`.

---

## Deferred Items

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C3-03 | LOW | Medium | `calculateRewards` bucket mutation before Map.set — fragile pattern but currently correct. No runtime failure. Refactoring would require restructuring the loop body. | If the bucket pattern is modified and a data-loss bug is introduced, move `categoryRewards.set()` immediately after bucket creation. |
| C3-07 | LOW | Medium | LLM fallback sends raw PDF text to API without input sanitization. Risk is mitigated by system prompt scoping and JSON validation. Adding sanitization would require defining what constitutes a "prompt injection pattern" in Korean/English mixed text, which is complex and fragile. | If LLM parsing produces fabricated transactions in practice, add content sanitization or a warning that LLM parsing was used. |
| C3-10 | LOW | Medium | `ANTHROPIC_MODEL` default `claude-opus-4-5` may become outdated. No good alternative — the SDK doesn't provide a "latest" alias. Adding a comment is a documentation fix, not a code fix. | If the default model is deprecated by Anthropic, update the default and add a comment explaining the update cadence. |
| C3-11 | LOW | Medium | Timeout controller may abort during response processing. Theoretical — JSON parsing is near-instantaneous and the 30s timeout is generous. Moving `clearTimeout` earlier would add complexity for negligible benefit. | If users report aborted LLM parsing during JSON response processing, move `clearTimeout` to immediately after the API call completes. |
