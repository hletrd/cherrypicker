# Cycle 8 — Critic

**Date:** 2026-04-24
**Reviewer:** critic
**Scope:** Multi-perspective critique of the full change surface

---

## C8-CT01: Fifth recurrence of hardcoded-taxonomy-duplicate pattern

- **Severity:** LOW (pattern-level concern)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-42` (latest instance)
- **Description:** The critic noted the third recurrence in cycle 7 (C7-CT01). This is now the fifth recurrence: C64-03 (original TODO), C6-02 (FALLBACK_CATEGORY_LABELS), C7-CR01 (CATEGORY_NAMES_KO), C7-CR02 (FALLBACK_CATEGORY_LABELS again), and now C8-CR02 (FALLBACK_GROUPS). Each review cycle identifies the same systemic issue, and each time it is deferred. The pattern is clear: the project needs a build-time taxonomy generation step. The exit criterion in the deferred items ("when the CLI is refactored to load labels dynamically, or when a build-time generation step produces the fallback data") has never been met. Recommending a dedicated mini-cycle to implement the build-time generation.

- **Fix:** Implement a `scripts/generate-fallbacks.ts` that reads `categories.yaml` and outputs all three fallback maps, then wire the generated files into the build pipeline. This eliminates the entire class of drift bugs at once.

---

No new HIGH or MEDIUM findings. The codebase is stable and well-tested.
