# Critic Review — CherryPicker Cycle 39

**Reviewer:** critic (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### C39-CRIT01 — Medium — Cycle reference comments have become noise

The codebase is littered with parenthetical cycle references: `(C98-02)`, `(C100-01)`, `(C32-V09)`, `(C37-02)`, etc. After 39 cycles, these number in the hundreds.

**Problem:**
1. They clutter the code and reduce readability
2. They reference plans/reviews that may no longer exist or be relevant
3. New contributors have no way to look up what `C32-V09` means
4. They create a false sense of documentation — the "why" is often missing

**Example:** `packages/parser/src/csv/shared.ts:131` has `(C70-04)` on `isValidCSVAmount`. What does this tell a reader? Nothing useful without access to cycle 70's review document.

**Recommendation:** Replace cycle references with actual explanatory comments, or remove them in favor of git blame. The commit messages already capture the context.

**Confidence:** Medium

---

### C39-CRIT02 — Medium — "Parity" comments are a symptom, not a solution

Comments like "Parity with server-side XLSX parser" appear dozens of times in the web-side code. They acknowledge duplication without addressing it.

**Problem:** These comments serve as guilt markers. They tell future maintainers "this code is duplicated, be careful" but don't provide any mechanism to prevent divergence. After 39 cycles, the web-side and server-side parsers have diverged in subtle ways (e.g., web-side HTML normalizeHTML has a while-loop, server-side doesn't).

**Recommendation:** Either eliminate the duplication (extract shared core) or accept the divergence and remove the parity comments. The current middle ground is the worst of both worlds.

**Confidence:** High

---

### C39-CRIT03 — Low — Calculator silently returns zero rewards for edge cases

When `previousMonthSpending` is NaN, or when no performance tier matches, or when no rule matches a transaction category, the calculator returns zero rewards without any warning or error. This is by design ("Intentionally silent" at reward.ts:198), but from a user perspective, it's confusing.

**Recommendation:** Consider adding a `warnings` array to `CalculationOutput` for non-fatal issues like "no tier matched" or "no rule found for category X". This would improve transparency without breaking the API.

**Confidence:** Low

---

## Cross-Agent Agreement

1. **parseAmountString trailing garbage** (CR-39-01, SEC-39-02): AGREED by code-reviewer, security-reviewer. The function silently accepts malformed input.
2. **Parser duplication** (ARCH-39-01, C39-CRIT02): AGREED by architect, critic. Parity comments are insufficient.
3. **calculateRewards NaN** (BUG-39-01): AGREED by debugger, architect. Core function lacks input validation.
