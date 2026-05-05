# Cycle 7 Document Specialist Review

**Date:** 2026-05-05
**Scope:** Doc/code mismatches, stale comments, incorrect claims
**Reviewer:** document-specialist

---

## Summary

One HIGH-severity documentation bug found: a code comment in the web-side JSON parser makes a false claim about server-side behavior. This comment actively misleads maintainers.

---

## HIGH

### DOC7-01: False comment in web-side JSON parser

**File:** `apps/web/src/lib/parser/json.ts:98-99`
**Confidence:** High

```ts
// Skip zero amounts (balance inquiries) but accept negative amounts
// (refunds/credits) by taking absolute value, matching server-side
// JSON parser behavior (C100-02).
```

This comment is factually incorrect. The server-side JSON parser does NOT take absolute value. It preserves negative amounts directly (`packages/parser/src/json/index.ts:114-124`). The comment was likely copy-pasted from an older version or written based on outdated knowledge.

**Impact:** Misleading comment causes future maintainers to believe the behavior is intentional parity, when it's actually a regression.

**Fix:** Update comment to reflect actual behavior, or better yet, fix the code to match the server-side.

---

## LOW

### DOC7-02: `FALLBACK_CATEGORY_LABELS` has stale comment about taxonomy

**File:** `apps/web/src/lib/category-labels.ts:21-24`
**Confidence:** Low

Comment says "Must be updated in lockstep with categories.yaml taxonomy" but there is no automation or checklist enforcing this. The comment documents a manual process that is bound to fail.

**Fix:** Replace with build-time generation or add a test that fails when taxonomy and fallback diverge.

### DOC7-03: `buildCategoryNamesKo` has contradictory deprecation status

**File:** `packages/rules/src/category-names.ts`
**Confidence:** Low

The function is exported but comments in consuming files suggest it's deprecated. Yet it's still in the public API with no `@deprecated` tag.

**Fix:** Add `@deprecated` JSDoc and migration path.

---

## Verified Documentation Accuracy

| Doc | Status |
|-----|--------|
| ParseError class JSDoc | Accurate |
| LLM consent prompt Korean text | Accurate |
| Path validation error messages | Accurate and descriptive |
| buildCategoryLabelMap JSDoc | Accurate |
