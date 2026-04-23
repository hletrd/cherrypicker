# Cycle 6 — critic (multi-angle critique)

## Meta-observation
The repo has invested heavily in e2e coverage (`e2e/ui-ux-review.spec.js` — 57
assertions spanning IA, a11y, responsive, CSP, data integrity), but the spec
has been pointing at the wrong port (`:4174` vs the config's `:4173`) for an
unknown number of cycles. Every invocation of `bun run test:e2e` that
crossed UI paths has been silently 100% no-op — a textbook case of
metric-theater where the test count rises but test-signal falls. **This is
the highest-order finding of the cycle** because all other UI findings
were supposedly guarded by the suite.

## Per-angle critiques

### Correctness
- C6UI-40: optimizer fixture vs reward.ts rule mismatch. The test fixture
  assumes broad `dining` covers `dining.cafe` transactions; the rule
  explicitly excludes that. Either the fixture is stale or a behavior was
  deliberately tightened without updating the fixture.

### UX
- C6UI-02: `role="progressbar"` on a 4-step stepper is semantic misuse. A
  stepper is an `<ol>` with `aria-current="step"` per APG.
- C6UI-10: CategoryBreakdown promises `role="button" aria-expanded` but
  Enter/Space only toggle a cosmetic hover. Keyboard users are lied to by
  the ARIA.
- C6UI-03: document-level DnD accepts drops anywhere but the drop-visual
  is only shown inside the dropzone rectangle.

### Maintainability
- C6UI-38: zero `data-testid` across the app. Tests rely on Korean strings;
  every UI copy change silently breaks the suite. Worse, the only UI
  test suite is already broken (C6UI-01), so no one noticed.
- C6UI-13: two different print strategies (inline `window.print()` vs
  named `cherrypickerPrint`) coexist. Asymmetry grows as pages accumulate.

### Data safety
- C6UI-16: no `beforeunload` during upload. Single keyboard miskey wipes
  work.
- C6UI-34: no `max` on 전월실적; a typo feeds garbage to the optimizer.

### Accessibility
- C6UI-08: amber/red class concatenation produces indistinct state for
  low-confidence uncategorized rows.
- C6UI-22: `text-blue-500` on `from-blue-50/-100` fails 4.5:1 for small text.
- C6UI-31: `text-green-600` fails 4.5:1 on white.

### Testing discipline
- C6UI-06: production label changed from "총 지출" → "최근 월 지출"; test
  still asserts "총 지출". Discovered only because I looked manually.
- The wrong-port issue (C6UI-01) makes every UI regression invisible.

## Prioritization recommendation
Top 3: C6UI-01 (unblock the suite) → C6UI-40 (restore passing gate) →
C6UI-16 (data-loss guardrail). Without fixing C6UI-01 first, fixing
anything else cannot be verified by CI.
