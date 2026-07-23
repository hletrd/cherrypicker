# Review-Plan-Fix Cycle 11 — Code Reviewer

**Date:** 2026-07-24
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Reviewed HEAD:** `5a8e636c0c66136ed3fff0396de226f77758a1bd`
**Mode:** review only; no implementation, staging, commit, push, deployment,
browser run, or E2E run

## Outcome

One genuinely new, reproducible finding remains at the pinned HEAD:

| ID | Severity | Confidence | Status | Summary |
|---|---|---|---|---|
| C11-CR-001 | Medium | High | Confirmed | Combining a native leading minus with either supported trailing-minus or Korean-minus notation flips a refund into positive spending |

No second issue cleared the combined correctness, reachability, confidence,
and historical-novelty threshold.

## Repository inventory and review boundary

The exact tracked manifest contains **2,274 paths**. Its filename-manifest
SHA-256 is
`8b15dbfc1093940063f141c9fb28442f628d4a333579a31b71aba87b93201ac5`.
Removing `.context/**` leaves **1,161 active paths**, with filename-manifest
SHA-256
`bfa6a661e70aca250527b7efe58e91a4c655521dc861b076d6333e5af1b03b41`.

| Partition | Tracked paths | Review treatment |
|---|---:|---|
| `.context/reviews` | 818 | Indexed completely; current RPF cycles and every historical sign-parsing hit opened and deduplicated |
| `.context/plans` | 295 (101 current/root, 194 archived) | Indexed completely; current plans, archived amount/parser plans, and the 1,942-line deferred ledger reviewed |
| `apps/**` | 168 | Web analysis/state/persistence, loaders, workers, parser adapters, components, tests, public artifacts, and configuration reviewed |
| `packages/**` | 876 | Core calculation/optimizer/categorizer, parser families, rules/schema/catalog, visualization, tests, generated outputs, and 707 card-data paths accounted for |
| `tools/**` | 63 | CLI and scraper commands, validation, trust boundaries, writer/fetcher behavior, fixtures, and targets reviewed |
| `scripts/**` | 19 | Publication, dependency/toolchain, README, migration, and E2E orchestration code reviewed statically |
| `e2e/**` | 16 | Specifications and configuration reviewed statically; not executed |
| Root/configuration/other | 19 | Workspace, package, TypeScript, CI, and repository policy surfaces reviewed |

Generated catalog/card files were reviewed through their canonical schema,
publication generator, aggregate counts/identity, changed records, and
consumer validation rather than treated as independent handwritten logic.
Cross-file sweeps covered parser input through analysis/optimization,
category and previous-spending provenance, reward/cap state, persistence and
restoration, worker settlement, catalog publication identity, CLI/report
output, scraper quarantine, and filesystem/publication behavior.

## Historical deduplication

- Cycle 40 and the protected Cycle 42 artifacts describe the exact
  parenthesized case `(-1234)`. That case is fixed by the special branch at
  `packages/parser/src/shared/amount.ts:36-41` and still returns `-1234`.
- Searches across all tracked reviews/plans and active tests found no prior
  report or regression for `-1000-`, `마이너스-1000`, a leading-minus plus
  trailing-minus composition, or a leading-minus plus Korean-minus
  composition. Existing tests exercise each notation separately.
- Archived Plan 69 requires ordinary parentheses, Korean-minus, full-width
  minus, and trailing-minus forms to remain negative, but does not exercise
  overlapping non-parenthesized markers. C11-CR-001 is therefore an incomplete
  sign-composition closure, not a re-report of the fixed parenthesized input.
- The previously rejected leading-NUL/prefixed-XLSX ZIP-inflation hypothesis
  was not revived. This review found no new executable evidence for it.

## C11-CR-001 — Overlapping supported minus forms are negated twice

**Region:** `packages/parser/src/shared/amount.ts:25-54`
**Fan-out:** `packages/parser/src/csv/shared.ts:47-51`,
`packages/parser/src/shared/json.ts:216-230`,
`packages/parser/src/xlsx/index.ts:343-370`,
`packages/parser/src/html/index.ts:251-274`, and
`apps/web/src/lib/parser/amount.ts:1-7`
**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

### Concrete failure

The canonical helper produces:

```text
parseAmountString("-1000-")       =>  1000
parseAmountString("마이너스-1000") =>  1000

parseAmountString("-1000")        => -1000
parseAmountString("1000-")        => -1000
parseAmountString("마이너스1000")  => -1000
parseAmountString("(-1000)")      => -1000
```

A read-only end-to-end generic CSV probe with:

```csv
date,merchant,amount
2026-01-15,REFUND,-1000-
```

returned a transaction whose `amount` is positive `1000`, with no parse
diagnostic. The row therefore survives `isValidCSVAmount` and enters spending
analysis instead of being rejected as a refund/non-spending row. JSON, XLSX,
HTML, PDF, OFX, CLI, and browser parsing share the same canonical amount
kernel, although the generic neutral CSV path above is sufficient to confirm
current product reachability.

### Root cause

Lines 25-34 remember Korean-minus/trailing-minus as a separate
`isNegative` boolean and strip those decorations, but they leave a native
leading `-` in the numeric payload. `Number(match[0])` consequently returns
`-1000`; line 54 then applies another negation and returns `+1000`.

The parenthesized case has a one-off “already negative” correction at lines
38-40. The other two supported negative decorators do not. The implementation
therefore models financial sign markers partly as polarity and partly as
arithmetic negations, so overlapping accepted forms are inconsistent.

### Root-cause fix

Normalize sign exactly once. After recognizing and removing supported outer
decorators, either:

1. treat the presence of any supported negative marker as negative polarity
   and apply it to the absolute parsed magnitude, or
2. reject redundant/contradictory sign encodings explicitly.

Do not negate an already-negative parsed payload. Remove the
parentheses-only special case in favor of one shared sign rule. Add direct
kernel regressions for leading-minus plus trailing-minus and Korean-minus plus
leading-minus (including full-width variants), then add generic CSV and JSON
entry-point checks proving that neither composition can yield a positive
transaction. The parsers should either keep the value negative and exclude it
from spending or emit a diagnostic; they must never turn it into spend.

## Verification and final missed-issue sweep

- Read-only direct probes reproduced both wrong helper results and the
  positive generic-CSV transaction.
- Active tests contain controls for each individual negative notation and for
  the fixed `(-1234)` case, but no overlapping-marker case.
- The final sweep revisited shared-state ownership, stale commits,
  transaction/category/month invariants, assignment/card/cap reconciliation,
  numeric overflow and error behavior, parser direction/provenance,
  generated-catalog identity, CLI/report disclosure, scraper trust, and
  publication tooling.
- Speculative items without a current concrete failure were not promoted.
  No source, test, generated artifact, or protected Cycle 42 path was changed.

## Provenance and protected artifacts

The six protected untracked Cycle 42 artifacts remained byte-identical,
untracked, and unstaged:

| Path | SHA-256 |
|---|---|
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` |

The only path written by this reviewer is:
`.context/reviews/2026-07-24-rpf-cycle11-code-reviewer.md`.
