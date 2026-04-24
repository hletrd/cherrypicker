# Cycle 3 — Critic (Multi-Perspective)

**Date:** 2026-04-24
**Reviewer:** critic
**Scope:** Full repository

---

## C3-CT01: Category map divergence risk is the most actionable issue this cycle (convergence of C3-A01, C3-CR03, C3-T02)

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** Multiple (see C3-A01 for full list)
- **Description:** The four independent hardcoded category maps identified by the architect (C3-A01) and code-reviewer (C3-CR03) represent the highest-signal finding this cycle. The test-engineer (C3-T02) confirms no automated consistency check exists. The `convenience_store` hierarchy inconsistency between FALLBACK_GROUPS (standalone group) and FALLBACK_CATEGORY_LABELS (subcategory of grocery) is a concrete, verifiable divergence that can be shown to a user today.
- **Failure scenario:** When categories.json fails to load, the user sees `convenience_store` as a top-level category in the transaction dropdown but as a subcategory of `grocery` in the card detail view.
- **Fix:** See C3-A01 fix.

## C3-CT02: Duplicate keyword across files is a low-signal but easily-fixable maintenance hazard (convergence of C3-CR01, C3-T01)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/keywords.ts:9187`, `packages/core/src/categorizer/keywords-english.ts:108`
- **Description:** The duplicate `SHAKE SHACK KOREA` entry (C3-CR01) is low-risk because the values are identical, but it's a maintenance trap. The test gap (C3-T01) means future duplicates won't be caught automatically. The fix is trivial: remove the duplicate and add a consistency test.
- **Failure scenario:** See C3-CR01.
- **Fix:** Remove duplicate from keywords-english.ts, add test.

---

## Final Sweep

This is a mature codebase with extensive prior review coverage (100+ cycles). The remaining issues are LOW severity maintenance and consistency concerns. No security, correctness, or data-loss findings. The most impactful finding is the category map divergence (C3-CT01) which extends the known C2-01 issue to a fourth map.
