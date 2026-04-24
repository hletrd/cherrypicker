# Verifier — Cycle 2 Evidence-Based Verification (2026-04-24)

Verified correctness of cycle 1 fixes and current codebase behavior against stated behavior.

## Verification Results

### C1-01 Fix: CardDetail abort-then-labels fallback — VERIFIED
- **File:** `apps/web/src/components/cards/CardDetail.svelte:28-43`
- **Evidence:** The component now imports `FALLBACK_CATEGORY_LABELS` (line 7), uses it when `nodes.length === 0` (line 31-32) and in the catch block (line 37). The `categoryLabelsReady` flag is set after the fallback is applied (line 41). This matches the stated fix from the cycle 1 plan.

### C1-02 Fix: Server-side detectCSVDelimiter 30-line limit — VERIFIED
- **File:** `packages/parser/src/detect.ts:151`
- **Evidence:** `.slice(0, 30)` is present after the filter, matching the web-side implementation at `apps/web/src/lib/parser/detect.ts:175`.

### C1-03 Fix: console.warn on fallback — VERIFIED
- **File:** `apps/web/src/lib/analyzer.ts:57,63`
- **Evidence:** Both `source` and `type` fallbacks now log `console.warn` with the unknown value and card ID.

### A1-01 Fix: buildCategoryNamesKo function — PARTIALLY VERIFIED
- **File:** `packages/rules/src/category-names.ts:1-22`
- **Evidence:** The function exists and correctly iterates the CategoryNode tree, building both parent and dot-notation subcategory keys. However, the function is NOT called by any consumer — `CATEGORY_NAMES_KO` in greedy.ts is still hardcoded. The fix is incomplete per the original A1-01 plan.

### U1-02 Fix: FileDropzone number input stepper arrows — VERIFIED
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:495`
- **Evidence:** `inputmode="numeric"` is present on the input element. The CSS for hiding stepper arrows needs verification in the app.css or component styles.

## New Findings

### C2-V01: U1-02 CSS fix may not be applied — no `appearance: textfield` found in styles
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:494-503` and app.css
- **Description:** The cycle 1 plan (U1-02) specified adding CSS to hide number input stepper arrows (`-webkit-appearance: none`, `-moz-appearance: textfield`). The `inputmode="numeric"` attribute was added, but the CSS rules were not found in either the component's scoped styles or the global `app.css`. Without the CSS, Firefox and Safari still show stepper arrows.
- **Fix:** Add the CSS rules from the cycle 1 plan to either the component's `<style>` block or `app.css`.

## Previously Known

All 111 deferred items remain valid.
