# Architectural Review — Cycle 2 (2026-04-19)

Reviewer: architect angle
Scope: System architecture, coupling, layering, design risks

---

## Finding C2-A01: Web app imports `@cherrypicker/core` but core returns `OptimizationResult` with Korean strings baked in

**File:** `packages/core/src/optimizer/greedy.ts:7-50`
**Severity:** MEDIUM
**Confidence:** High

The `CATEGORY_NAMES_KO` hardcoded dictionary in `greedy.ts` violates separation of concerns. The core optimization package should not contain UI-facing Korean string labels — it should return category IDs and let the presentation layer map them to display names.

Currently, `CardAssignment.categoryNameKo` and `CategoryReward.categoryNameKo` are set from this dictionary. If a new category is added to `categories.yaml` but not to `CATEGORY_NAMES_KO`, the category ID itself is used as the display name (which is an English slug like `online_grocery`).

**Fix:** Move `CATEGORY_NAMES_KO` to `apps/web/src/lib/formatters.ts` (which already has `getCategoryIconName` and `formatIssuerNameKo`). Have the core package return only category IDs, and let the web layer look up Korean labels from the taxonomy.

---

## Finding C2-A02: Duplicate bank detection logic across three files

**Files:**
- `packages/parser/src/detect.ts` (Bun, uses `readFile`)
- `apps/web/src/lib/parser/detect.ts` (browser, uses `File` API)
- `apps/web/src/lib/parser/csv.ts` (inline adapter `detect()` methods)

**Severity:** MEDIUM
**Confidence:** High

The `BANK_SIGNATURES` array is duplicated identically between `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts`. Additionally, each CSV bank adapter has its own `detect()` method with the same regex patterns. If a new bank is added, three places must be updated.

Already deferred as D-01 (duplicate parser implementations). This is the symptom of the deeper architectural issue.

**Fix:** Extract the bank signature data into `packages/rules/data/bank-signatures.yaml` and generate both detection modules from it at build time.

---

## Finding C2-A03: `ILP` optimizer is a stub that just delegates to greedy with a console warning

**File:** `packages/core/src/optimizer/ilp.ts`
**Severity:** LOW
**Confidence:** High

The ILP optimizer file exists and is exported from the public API but does nothing useful. Every call to `ilpOptimize()` logs a warning to the console and falls back to greedy. This means:
1. Production code has unnecessary warning noise
2. The public API advertises a feature that doesn't exist
3. Importing the module adds dead code to the bundle

**Fix:** Either implement the ILP optimizer (using glpk.js as documented), or remove it from the public API and add it back when ready. The stub can remain internally but should not be exported.

---

## Finding C2-A04: `packages/core/src/models/card.ts` exports `CardMeta` and `CardRuleSet` but these overlap with `@cherrypicker/rules`

**File:** `packages/core/src/models/card.ts` (not read but referenced in index.ts)
**Severity:** LOW
**Confidence:** Medium

The core package has its own `CardRuleSet` type while the rules package also defines `CardRuleSet` via Zod schema. The analyzer adapter `toCoreCardRuleSets` bridges between them, but having two separate types for the same concept increases maintenance burden.

**Fix:** Have `packages/core` import and re-export `CardRuleSet` from `@cherrypicker/rules` directly, eliminating the duplicate type definition.

---

## Finding C2-A05: Web store persistence uses `sessionStorage` which is tab-scoped

**File:** `apps/web/src/lib/store.svelte.ts:89-155`
**Severity:** LOW
**Confidence:** High

Analysis results are persisted in `sessionStorage`, which means:
- Opening a new tab to `/dashboard` won't have the data
- Closing the tab loses the data permanently
- The "session warning banner" correctly warns about this

This is a design choice, not a bug, but it means users who habitually open links in new tabs won't see their results. `localStorage` would survive tab closure and be available across tabs.

**Status:** Acknowledged as intentional design (privacy-conscious — no persistent financial data). No action needed.
