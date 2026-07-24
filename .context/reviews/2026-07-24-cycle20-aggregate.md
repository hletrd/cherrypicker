# Review-plan-fix Cycle 20 — aggregate

## Review identity

- Date: 2026-07-24
- Revision: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Deploy mode: none
- Roles completed: code-reviewer, perf-reviewer, security-reviewer, critic,
  verifier, test-engineer, tracer, architect, debugger,
  document-specialist, designer, dependency-expert, and qa-tester
- Genuinely new Cycle 20 findings after deduplication: **0**
- Confirmed historical repair obligations: **1**

## Executive result

Cycle 20 found no genuinely new root issue. The review did independently
reproduce one current Low-severity, High-confidence integrity defect:

> A transaction-truncated snapshot can carry positive spending in a monthly
> bucket whose transaction count is zero, pass coherence and persistence
> admission, and contribute phantom money to the restored dashboard total.

This is not counted as a new Cycle 20 finding. Archived Plan 109 explicitly
owns coherent monthly count/spending summaries, atomic rejection of
contradictory truncated snapshots, and prevention of stale financial totals.
The current behavior is a completion gap in that documented contract.

The obligation remains actionable. Prompt 2 must reopen Plan 109, and Prompt
3 must close the missed invariant rather than defer it.

## Fan-out and provenance

The repository exposes generic collaboration agents rather than named
reviewer implementations. Three parallel review threads covered nine roles.
The remaining four roles were completed through a reused finished review
thread after the runtime's child-thread cap prevented another fresh thread.
Every required role returned a separate canonical report and a dated Cycle
20 provenance report.

| Role | New roots | Historical obligations | Disposition |
| --- | ---: | ---: | --- |
| code-reviewer | 0 | 0 | No new code-quality root |
| perf-reviewer | 0 | 0 | No new performance root |
| security-reviewer | 0 | 0 | No new security root |
| critic | 0 | 1 | Confirmed Plan 109 gap |
| verifier | 0 | 1 | Reproduced Plan 109 gap |
| test-engineer | 0 | 1 | Attached missing regressions |
| tracer | 0 | 1 | Confirmed causal chain |
| architect | 0 | 1 | Confirmed domain-boundary mismatch |
| debugger | 0 | 1 | Reproduced acceptance and rendering consequence |
| document-specialist | 0 | 1 | Confirmed Plan 109's exact ownership |
| designer | 0 | 1 | Confirmed downstream trust consequence |
| dependency-expert | 0 | 0 | No dependency impact or defect |
| qa-tester | 0 | 1 | Confirmed boundary and regression gap |

The canonical and dated designer/QA reports were corrected by their author
before aggregation to use the actual dashboard component and web-test paths.

### AGENT FAILURES

A fresh Cluster D spawn failed because the collaboration runtime had reached
its thread limit. The required direct retry and nested retry also returned
the same capacity error. No specialist review failed or was dropped: the
completed Cluster B thread was reused to perform the four outstanding roles,
and all four report pairs returned and passed `git diff --check`.

## Historical repair obligation C20-B-001 — zero-count monthly bucket carries phantom spending

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed current defect**
- Novelty: **not new; archived Plan 109 completion gap**
- Cross-role agreement: critic, verifier, test-engineer, tracer, architect,
  debugger, document-specialist, designer, and qa-tester
- Producer:
  `packages/core/src/analysis/context.ts:157-175,189-205`
- Truncated coherence:
  `apps/web/src/lib/analysis-result.ts:926-984`
- Persistence admission:
  `apps/web/src/lib/persistence.ts:822-844,867-925`
- User-visible consumer:
  `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`
- Historical owner:
  `.context/plans/_archive/109-cycle8-analysis-coherence.md:17-76`

### Producer invariant

The canonical analysis-context producer creates a monthly bucket only while
processing a validated transaction and increments that bucket's count on the
same path. A real bucket may have zero spending when its rows are refunds or
zero-value transactions, but it cannot contain zero transactions.

Therefore:

```text
spending = 0, transactionCount > 0
```

is valid, while:

```text
spending > 0, transactionCount = 0
```

is outside the producer domain.

### Validation gap

`hasCoherentTruncatedFacts()` rejects a monthly count only when it is below
zero. A zero count contributes nothing to the represented transaction total.
The previous-month provenance callback then treats that same bucket as absent
because it checks whether its count is greater than zero.

Persistence separately admits the nonnegative count and delegates to the
same semantic validator. An otherwise coherent current-version truncated
payload can consequently state all of the following at once:

- a prior month contains positive spending;
- that month contains no transactions; and
- the prior month was missing and therefore assumed to have zero spending.

### Reproduction and consequence

Independent review probes used an older monthly bucket with 777,777 won and
zero transactions, a latest bucket with 10,000 won and one transaction, a
positive truncation count, and a `missing-calendar-month` basis for the older
month.

Current behavior was:

```text
isAnalysisResultCoherent(...) = true
deserializeAnalysis(...).data is present
warningKind = "truncated"
```

The restored dashboard sums every monthly spending value and therefore shows
787,777 won across all months even though the stored represented transaction
count is one and the provenance says the older month was missing.

Fresh analysis cannot create this state. It requires corrupted, tampered, or
incompatible current-version persisted data, which bounds severity to Low.
It still violates the deserializer's fail-closed integrity contract.

### Required repair

1. Require every stored monthly bucket to have a positive safe-integer
   `transactionCount` in both pure truncated coherence and persistence
   structural admission.
2. Keep zero spending valid when the count is positive.
3. Add a pure-coherence rejection for the phantom prior bucket.
4. Add a current-version deserializer rejection/removal regression.
5. Add a valid zero-spending, positive-count previous-month control and
   preserve ordinary truncation round trips.
6. Keep the repair in the validator/persistence boundary; do not mask the
   malformed state in the UI.

## Historical reconciliation

Plan 109 already promised:

- reconciliation of monthly counts and spending;
- exact handling of intentionally truncated snapshots;
- atomic rejection of contradictory derived fields; and
- prevention of stale financial totals reaching the dashboard.

C20-B-001 is the same root with one missed relational edge, so it does not
inflate `NEW_FINDINGS`.

Cycle 18's YearMonth representation, catalog publication identity, and
module-TypeScript ownership repairs remain closed. Cycle 19's lower-bound
month-basis totality and persistence fail-closed repair also remain closed.
Known parser duplication, optimizer complexity, static-host CSP limitations,
session-storage scope, mixed-runner policy, and other explicit historical
owners were not reissued.

No additional correctness, security, data-loss, performance, dependency,
architecture, documentation, QA, or UI/UX root survived the final sweeps.

## Designer/browser evidence and cleanup

The cycle owner read and used the agent-browser core, interact, query, wait,
network, visual, debug, state, and config skills for one isolated designer
session:

- session `cherrypicker-c20-designer-20260724`;
- profile `/tmp/cherrypicker-c20-designer-profile.vEefVJ`;
- preview parent/listener `34463/34554`, PGID `34463`, port `4190`;
- browser daemon/root `38457/38460`, PGID `38457`.

Textual live evidence covered semantic landmarks and headings, the upload
status/list/input, desktop and mobile overflow, skip-link focus, menu
expanded state and Escape focus restoration, settled light/dark colors, RTL
stress, local resource timing, and local request boundaries. No new
designer root survived source/history reconciliation.

An intentionally aborted catalog-summary request left one navigation command
and one follow-up command stale. Exact command PGIDs `51658` and `68390`
were terminated. Because the browser daemon remained command-locked, its
already-attributed PGID `38457` was terminated directly. The preview PTY was
closed, all exact trees and the port listener disappeared, and the profile
was moved recoverably to
`/Users/hletrd/.Trash/cherrypicker-c20-designer-profile.vEefVJ-20260724`.
`agent-browser session list` reported no active sessions and
`bun scripts/run-e2e.ts status --assert-clean` reported a clean repository.
Unrelated interactive Chrome PID/PGID `1368/1368` was preserved.

## Read-only verification

Review agents collectively confirmed:

- 2,424 tracked paths inventoried, including 1,172 active paths;
- 215 focused analysis/persistence tests with 543 expectations;
- 319 additional focused security/performance/code tests;
- 383 focused tracer/architecture/debugger tests;
- Astro checking of 126 files with zero errors, warnings, or hints;
- passing lint, typecheck, dependency ownership, audit, generated-data,
  documentation-drift, and bundle-budget checks;
- 683 cards, 24 issuers, and 551 optimizer-executable records;
- no active skip/only/todo marker;
- exact local/origin baseline parity before review; and
- unchanged hashes for all six protected Cycle 42 artifacts.

Prompt 1 did not run the full E2E gate, modify production source, deploy,
release, or publish.

## Prompt 1 disposition

- `NEW_FINDINGS = 0`
- Historical repair obligations requiring a reopened plan: 1
- Deployment: none
