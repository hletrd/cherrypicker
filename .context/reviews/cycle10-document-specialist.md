# Cycle 10 Document Specialist Review

**Reviewer:** document-specialist  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P2-MEDIUM] TODO comment without tracking — packages/core/src/calculator/reward.ts:78
**Description:** `// TODO: If a future card's terms explicitly include subcategories...`
**Impact:** Unclear if this is a planned feature or a known limitation. No issue or plan tracks it.
**Fix:** Convert to a GitHub issue or add to backlog.
**Confidence:** Low

### [P2-MEDIUM] Layout.astro CSP TODO is stale — apps/web/src/layouts/Layout.astro:46
**Description:** TODO comment about nonce-based CSP has existed for multiple cycles.
**Impact:** Security documentation/code mismatch — stated intent but no implementation.
**Fix:** Implement CSP or remove TODO with justification.
**Confidence:** Medium

### [P3-LOW] Package descriptions in package.json are generic
**Description:** All packages have version "0.1.0" and minimal descriptions.
**Impact:** Monorepo tooling and npm displays show unhelpful metadata.
**Fix:** Update package.json with accurate versions and descriptions.
**Confidence:** Low

### [P3-LOW] Missing inline docs for public API functions
**Description:** Many exported functions in packages/core/src/ lack JSDoc comments.
**Impact:** IDE hover information is unhelpful for consumers.
**Fix:** Add JSDoc to public exports.
**Confidence:** Low

---

## Summary Table

| Severity | Count |
|----------|-------|
| P2-MEDIUM | 2 |
| P3-LOW | 2 |

**Verdict:** FIX AND SHIP
