# Critic — Cycle 2 Multi-Perspective Critique (2026-04-24)

Reviewed the entire change surface from multiple perspectives: correctness, maintainability, consistency, and user experience.

## New Findings

### C2-CT01: Three independent hardcoded category label maps create a maintenance trilemma
- **Severity:** MEDIUM
- **Confidence:** High
- **Files:**
  - `packages/core/src/optimizer/greedy.ts:11-89` (`CATEGORY_NAMES_KO`)
  - `apps/web/src/lib/category-labels.ts:32-111` (`FALLBACK_CATEGORY_LABELS`)
  - `packages/rules/src/category-names.ts` (`buildCategoryNamesKo` — unused)
- **Description:** There are now THREE independent copies of the category label data: (1) `CATEGORY_NAMES_KO` in the core optimizer, (2) `FALLBACK_CATEGORY_LABELS` in the web app, and (3) `buildCategoryNamesKo()` in the rules package which can generate the authoritative map from the taxonomy but is not called by either consumer. This is worse than the original A1-01 finding which identified ONE duplicate — cycle 1's partial fix added a THIRD copy without connecting the consumers to the authoritative source. The risk of divergence is now higher than before.
- **Fix:** This is the core architectural issue to address: connect `CATEGORY_NAMES_KO` and `FALLBACK_CATEGORY_LABELS` to `buildCategoryNamesKo()` or directly to `categories.yaml` at build time.

### C2-CT02: `FALLBACK_CATEGORY_LABELS` has entries not in `CATEGORY_NAMES_KO` and vice versa
- **Severity:** LOW
- **Confidence:** High
- **File:** Cross-reference of `apps/web/src/lib/category-labels.ts:32-111` vs `packages/core/src/optimizer/greedy.ts:11-89`
- **Description:** Concrete divergences found:
  - `FALLBACK_CATEGORY_LABELS` has `subscription.general` (line 106) — `CATEGORY_NAMES_KO` does not
  - `FALLBACK_CATEGORY_LABELS` has `entertainment.subscription` (line 101) — `CATEGORY_NAMES_KO` has `subscription: '구독'` (different key structure)
  - `CATEGORY_NAMES_KO` has `grocery: '식료품/마트'` (line 18) — `FALLBACK_CATEGORY_LABELS` has `grocery: '식료품'` (different label text)
  - `FALLBACK_CATEGORY_LABELS` has standalone `cafe` (line 36) — `CATEGORY_NAMES_KO` has it too (line 15) but `buildCategoryLabelMap()` deliberately excludes standalone sub-IDs (per C2-D01)
- **Fix:** Unify both maps from the authoritative taxonomy source.

## Previously Known

All 111 deferred items remain valid. The trilemma finding (C2-CT01) extends and elevates the original A1-01 finding.
