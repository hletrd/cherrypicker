# Cycle 7 — Critic

**Date:** 2026-04-24
**Reviewer:** critic
**Scope:** Multi-perspective critique

---

## C7-CT01: Category label duplication is a systemic DRY violation, not isolated

- **Severity:** MEDIUM
- **Confidence:** High
- **Description:** This is the fourth recurrence of a pattern where hardcoded data duplicates the YAML taxonomy:
  1. C64-03 (TODO): CATEGORY_NAMES_KO can silently drift
  2. C6-02: getBaseUrl() duplicates trailing-slash logic from buildPageUrl()
  3. C7-CR01: CATEGORY_NAMES_KO still not fixed
  4. C7-CR02: FALLBACK_CATEGORY_LABELS also hardcoded

  The root cause is the same each time: code that should be generated or imported at build time is instead hand-maintained in multiple locations. Each cycle finds a new instance because the review only looks at the file mentioned in the previous finding. The fix should be structural: a single build-time generation step that produces all fallback data from the YAML source, eliminating the entire class of drift bugs.

---

## Final Sweep

The codebase is in very good shape. The remaining issues are LOW/MEDIUM code quality items around hardcoded label duplication. No architectural, security, or correctness concerns beyond what is already tracked.
