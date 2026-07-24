# Cycle 19 verifier review

Date: 2026-07-24
Baseline: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
Full provenance: `.context/reviews/2026-07-24-cycle19-verifier.md`

## Result

**1 genuinely new finding: C19-VR-001 (Low / High confidence).**

The Cycle 18 catalog and dependency repairs verify cleanly. The new finding is
the same root independently retained by the debugger and must be deduplicated
once in the aggregate.

## Inventory and executed evidence

All 2,409 tracked paths and the complete 66-path Cycle 18 delta were included.
The protected untracked Cycle 42 paths were excluded.

- 77 focused tests passed with 185 expectations.
- Core `tsc --noEmit` passed.
- Web `astro check` reported zero errors, warnings, and hints.
- Dependency and data/document drift gates passed.
- Data check covered 683 cards, 24 issuers, and 551 executable cards.
- `bun audit --json` returned an empty advisory result.
- One publication hash appears at all 30 advertised identity sites.
- All six Cycle 18 commits have good signatures; local/remote parity is exact.

No browser, E2E, deployment, publication, or source mutation was used.

## C19-VR-001 — lower-bound exception escapes truncated validation

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed** by source trace and current-baseline probes
- Constructor/error: `packages/core/src/analysis/context.ts:77-114`
- Coherence path: `apps/web/src/lib/analysis-result.ts:893-981`
- Persistence path: `apps/web/src/lib/persistence.ts:522-547,677-708,720-922`
- Store recovery: `apps/web/src/lib/store.svelte.ts:117-148`

`isYearMonth()` admits `0000-01`, while `previousCalendarMonth()` deliberately
throws because no representable predecessor exists. The truncated coherence
path validates the month, selects it as latest, and unconditionally computes
its predecessor. It does this even for a `user-total` basis that needs no
calendar predecessor.

An otherwise internally balanced truncated snapshot reproduced the exact
`RangeError` through `isAnalysisResultCoherent()`. A structurally admitted
current-version persisted form reproduced it through `deserializeAnalysis()`,
which should instead return an ordinary corrupted result. The store catches
the exception, deletes the entry, and reports a generic storage-access problem,
so user impact is bounded and recovery exists.

Root fix:

1. Do not derive a predecessor for `user-total`.
2. Treat a non-representable predecessor as false coherence for calendar-based
   bases, not as an escaping exception.
3. Add no-throw/fail-closed coherence and persistence regressions for
   `0000-01`; retain the public helper's deliberate `RangeError`.

Before Cycle 18, this boundary produced a malformed string and coherence
returned false. The escaping exception was introduced by `9cb5bfe`, so this is
a new regression rather than a re-report of the leading-zero root.

## Other Cycle 18 repairs

The branded month type, successful predecessor closure, January-1000 context,
`.mts`/`.cts` production/test/config admission, direct ownership rules,
identity-free legacy projections, version split, mutation tests, and common
30-site publication hash all verify as intended. No second candidate survived
the final history and missed-issue sweep.

Confirmed findings: **1**; likely: **0**; manual-only promoted: **0**.
