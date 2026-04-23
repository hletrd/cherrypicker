# Cycle 9 — critic

Scope: stress-test cycle-8 plan and deferred-items ledger, challenge promotions vs deferrals.

## CR9-01 — `setResult` deferral is no longer defensible (MEDIUM)

Cycle 7 deferred D7-M2 with exit criterion "first caller appears, or the method is deleted". Cycle 8 re-audited and explicitly called out `setResult` as a "candidate for deletion next cycle". That next cycle is this one. Re-audit confirms:
- 0 callers across `apps/`, `e2e/`, `packages/`, `tools/`.
- C8CR-01 (LOW / Medium) is fully subsumed by deletion.
- Deletion is 8 lines; risk-free; satisfies exit criterion literally.

Holding D7-M2 deferred for another cycle would be deferred-fix hygiene failure per the repo's strict deferral rules. Promote and delete.

## CR9-02 — architectural deferrals (D7-M6, D7-M11, D7-M13) stay deferred, exit criteria intact

- D7-M6: tied to A7-02 persistence-module extraction — that refactor is out-of-scope for a 1-cycle fix, exit criterion unchanged.
- D7-M11: architectural refactors (A7-01/02/03) — cross-cycle, exit criterion unchanged.
- D7-M13: `unsafe-inline` CSP — Astro nonce upstream gate, exit criterion unchanged.

These are not deferred-fix hygiene failures; they are legitimately scoped out by their own exit criteria.

## CR9-03 — axe-core gate (D7-M8, C6UI-04/05) requires new dependency — defer

Adding `@axe-core/playwright` + writing a gate test is >1 day of work, out of scope for a review-plan-fix cycle focused on existing findings. Severity preserved MEDIUM, exit criterion unchanged.

No other critic findings.

Confidence: High.
