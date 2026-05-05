# Critic — cherrypicker (Cycle 18)

**Reviewer:** critic
**Scope:** Multi-perspective critique of the whole change surface
**Date:** 2026-05-06

---

## Summary

After 18 review cycles, the codebase shows steady improvement in bug-fix velocity but persistent architectural debt. The server/web parser duplication (reported in every cycle since cycle 2) remains unaddressed. Cycle 17 successfully closed 6 parity bugs but did not change the structural model that produces them. The deferred-fix tracking system still lacks a unified registry.

---

## Cross-Agent Agreement (High-Signal)

### C18-CR01 — `loadFromStorage` callback `any` types
- **Agents:** code-reviewer (MEDIUM), debugger (LOW), verifier (PARTIAL)
- **Consensus:** The MIGRATIONS type was fixed but `.filter()` and `.map()` callbacks in persistence code still use `any`. This is a partial fix that leaves type-safety gaps.

---

## New Findings

### C18-CRIT01 [MEDIUM] — Partial fixes create false confidence

**Files:** `apps/web/src/lib/store.svelte.ts`
**Confidence:** High

Cycle 17 fixed the `MIGRATIONS` type from `any` to `unknown`, but two related `any` usages in the same file were not addressed. This pattern — fixing the headline issue while leaving related code paths untouched — creates false confidence. Developers reading the commit message see "fix MIGRATIONS any type" and assume the file is now type-safe.

**The deeper issue:** Code review and automated testing did not catch the adjacent `any` types because they are in callback positions where the compiler does not flag `any` as aggressively.

**Fix:** Run `grep -n ': any' apps/web/src/lib/store.svelte.ts` as a pre-commit check. Or enable `@typescript-eslint/no-explicit-any` in the linter.

---

### C18-CRIT02 [LOW] — Review cycle velocity exceeds fix velocity for structural debt

**Confidence:** High

After 18 cycles:
- A-ARCH-01 (parser duplication): deferred every cycle
- A-ARCH-03 (CardRuleSet inline): deferred every cycle
- F-CRI-03 (deferred-fix tracking): deferred every cycle

The cost of deferring A-ARCH-01 compounds with each new format. JSON, OFX, and HTML were added since cycle 2; each required manual parity synchronization between server and web. The cumulative fix cost now exceeds the refactor cost.

**Fix:** Schedule a dedicated architecture sprint for A-ARCH-01. Accept short-term velocity reduction for long-term maintainability.

---

## Verdict

**FIX AND SHIP C18-CR01** — Close the type-safety gap. **SCHEDULE A-ARCH-01** — The parser duplication is now more expensive to maintain than to fix.
