# Plan 139: Cycle 13 Prepared Cap Validation

**Finding:** C13-002 (`RPF13-PERF-001`, Medium/High)
**Status:** planned
**Deploy mode:** none

## Evidence

- `assertCoherentCapGroupMonthlyCaps()` scans supported rewards and tiers and
  builds nested maps on every public `calculateRewards()` call.
- The greedy optimizer replays that calculator many times with the same
  immutable card-rule objects while scoring, assigning, comparing
  alternatives, building card outputs, and evaluating the best single card.
- A real 682-card, 100-transaction run made 125,075 calculator calls and
  created 451,946 validation maps.
- Alternating output-equivalent runs measured 267.6 ms at current HEAD versus
  221.8 ms without only the repeated already-valid-card check. An independent
  verifier reproduced a 16.1 percent regression, and 1,000 transactions paid
  about 301.7 ms of avoidable work.
- Public direct calculator callers can pass arbitrary mutable rules, so
  removing validation globally or using an unguarded process-wide identity
  cache would weaken fail-closed behavior.

## Outcome

Each retained executable `CardRuleSet` entry is structurally validated exactly
once before replay.
Optimizer calculations use an invocation-scoped opaque prepared value that
cannot be forged through the public package API. Direct `calculateRewards()`
calls continue to validate every arbitrary input and reject malformed shared
cap groups.

## Implementation

1. Add a red deterministic operation-count regression with at least two cards
   and two transactions. It must prove exactly one combined structural
   preparation per retained executable card entry while marginal, assignment,
   alternative, card-result, and best-single paths all execute.
2. Add malformed shared-group fixtures at both public boundaries. Direct
   `calculateRewards()` and `greedyOptimize()` must fail before returning a
   partial result. A malformed executable card and zero transactions must still
   fail during eager optimizer preflight, before any calculation-kernel replay.
3. Extract the existing uniqueness and cap-coherence assertions into one
   validation step that produces an opaque, branded prepared-card value.
   Keep the constructor private to the core implementation and do not export
   an unchecked fast path from the package barrel.
4. At the optimizer boundary, prepare every executable distinct card once for
   the current invocation. Route marginal scoring, alternatives, card output,
   and best-single replay through a calculation function that accepts only the
   prepared value. Preserve entries by object/value, never by `card.id` alone.
5. Keep public `calculateRewards()` as a validating wrapper around the shared
   calculation kernel. Do not retain prepared identities beyond the optimizer
   invocation and do not rely on a bare `WeakSet` across mutable caller input.
6. Bypass only immutable reward-tier uniqueness and cap-group-coherence scans.
   Transaction and previous-spending validation, cap safe-integer checks,
   unsupported-unit handling, checked arithmetic, and every execution-time
   invariant remain active at their existing boundary or replay site.
7. Use an invocation-local injected observer or internal test seam for
   validation counts. It must not be a module-global counter, public export, or
   production hot-path cost. Keep timings as supporting evidence rather than
   the regression oracle.
8. Call `greedyOptimize()` twice with the same objects and require a fresh
   exact card count each time. Call public `calculateRewards()` twice with the
   same object and require two preparations. Mutate a formerly valid cap group
   before the next call/invocation and require a throw, proving no
   cross-invocation cache bypass.
9. Add deep and serialized output parity, plus a public-export contract proving
   the opaque constructor and unchecked kernel are not barrel-exported.
10. Re-run full calculator, optimizer, catalog-validation, worker-transfer,
    and CLI optimize/report coverage. Repeat a bounded real-catalog benchmark
    and verify byte-identical output.

## Acceptance

- [ ] Each retained executable optimizer card entry performs exactly one
      combined structural preparation per optimization run.
- [ ] Direct calculator calls still validate every supplied rule input.
- [ ] Malformed shared cap groups fail closed through both public entry points.
- [ ] Malformed zero-transaction optimizer input fails before kernel replay.
- [ ] Prepared and direct calculation produce byte-identical supported-card
      results.
- [ ] Marginal, alternative, card-result, and best-single paths all use the
      prepared value.
- [ ] Reusing or mutating the same objects across calls cannot reuse validation.
- [ ] Runtime numeric, unsupported-rule, and checked-arithmetic guards remain
      active on prepared replays.
- [ ] No process-wide mutable-input cache or publicly forgeable unchecked path
      is introduced.
- [ ] A bounded real-catalog comparison shows the repeated-map cost removed
      without changing optimizer output.

## Verification

Run focused calculator, optimizer, catalog-validation, worker, and CLI tests,
then `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test`,
`bun run test:bun`, `bunx vitest run`, and `bun run verify`. Finish with
`bun run test:e2e`, `bun scripts/run-e2e.ts status --assert-clean`, TCP 4173,
and exact ownership/process cleanup checks.

## Execution note

The requested `ralph` capability is unavailable. Prompt 3 will use the approved
manual disciplined fallback: create the deterministic failing regression,
make the smallest lifecycle change, run focused green and parity checks, and
then run every repository gate. No deployment is permitted.
