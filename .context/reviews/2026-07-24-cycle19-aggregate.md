# Review-plan-fix Cycle 19 — aggregate

## Review identity

- Date: 2026-07-24
- Revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Deploy mode: none
- Roles completed: code-reviewer, perf-reviewer, security-reviewer, critic,
  verifier, test-engineer, tracer, architect, debugger,
  document-specialist, designer, dependency-expert, and qa-tester
- New findings after deduplication: **1**
- Severity/confidence: **Low / High**

## Executive result

Cycle 19 found one new regression at the boundary introduced by Cycle 18's
otherwise-correct `YearMonth` lower-bound policy:

> `0000-01` is a valid `YearMonth`, and its public predecessor helper
> deliberately throws because no four-digit predecessor exists. Older
> boolean coherence and persistence admission paths still assume predecessor
> construction is total, so a structurally admitted truncated snapshot can
> throw instead of failing closed.

This is one root, not separate findings for each caller or reviewer.
Supported statement parsers restrict dates to 1900–2100, and the store has an
outer recovery catch, so impact is limited to constructed, tampered, or stale
state and severity remains Low.

No second current correctness, security, performance, dependency,
architecture, test, documentation, QA, or UI/UX root survived source tracing,
runtime verification, history reconciliation, and the final missed-issue
sweeps.

## Fan-out and provenance

All required roles returned and retained separate dated and canonical reports:

| Role | Novel roots | Disposition |
| --- | ---: | --- |
| code-reviewer | 1 | Retained `C19-CR-001` |
| perf-reviewer | 0 | No new performance root |
| security-reviewer | 0 | Reliability issue acknowledged; no security boundary |
| critic | 1 | Same root as `C19-CR-001` |
| verifier | 1 | Same root independently reproduced |
| test-engineer | 0 | Missing regressions attached to the shared root |
| tracer | 1 | Same causal chain |
| architect | 1 | Same partial-operation/total-validator mismatch |
| debugger | 1 | Same root, including unnecessary user-total predecessor |
| document-specialist | 0 | Existing fail-closed contract corroborates root |
| designer | 0 | No new UI/UX/browser root |
| dependency-expert | 0 | Cycle 18 extension repair verified |
| qa-tester | 0 | Shared root confirmed; no additional QA root |

The initially requested experience-reviewer child could not be created while
older loop threads consumed the runtime's thread limit. Its four roles were
completed locally, then the spawn was retried once after capacity became
available. The retry and its two read-only cross-checks completed, required
four narrow report-accuracy corrections, and confirmed the same one-root
disposition.

### AGENT FAILURES

None after the required retry. No role was dropped.

## C19-001 — partial `YearMonth` predecessor escapes total validators

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed**
- Cross-agent agreement: code-reviewer, critic, verifier, tracer, architect,
  debugger, test-engineer, document-specialist, and qa-tester
- Direct domain operation:
  `packages/core/src/analysis/context.ts:77-114`
- Basis validator:
  `apps/web/src/lib/analysis-result.ts:893-920`
- Truncated coherence:
  `apps/web/src/lib/analysis-result.ts:922-981,1031-1038`
- Persistence shape admission:
  `apps/web/src/lib/persistence.ts:522-547,677-708,822-845`
- Escaping persistence call:
  `apps/web/src/lib/persistence.ts:860-915`
- Store recovery:
  `apps/web/src/lib/store.svelte.ts:117-148`

### Evidence

`isYearMonth()` intentionally accepts exact `YYYY-MM` values from years
`0000` through `9999`. `previousCalendarMonth()` intentionally raises:

```text
RangeError: YearMonth 0000-01 has no representable previous month
```

for the one lower-bound value. The public helper contract is correct and must
remain explicit.

A current-version truncated snapshot can nevertheless pass structural
admission with:

- no `transactions`;
- a positive `_truncatedTxCount`;
- internally balanced category/optimizer totals;
- a latest `monthlyBreakdown` entry at `0000-01`; and
- a valid user-total, statement-month, or missing-calendar-month basis.

`hasCoherentTruncatedFacts()` validates the month, then unconditionally
derives its predecessor before basis-kind handling. That throws even for a
`user-total` basis, where no calendar predecessor is needed.
`deserializeAnalysis()` invokes coherence after its JSON and migration catch
blocks, so the same exception escapes the pure data-admission API.

Independent runtime probes reproduced the exception through both
`isAnalysisResultCoherent()` and `deserializeAnalysis()`. The store's outer
catch removes the payload and prevents a route crash, but classifies the
deterministic corrupted-domain input as a storage-access error. Direct
callers still receive the exception.

The full transaction-backed path is not another affected path: year `0000`
transaction dates fail ISO-date validation before predecessor derivation.

### Novelty

Cycle 18 and Plan 148 deliberately own:

- the branded `YearMonth` constructor;
- exact four-digit predecessor closure;
- January 1000 to December 0999;
- and the public `0000-01` lower-bound exception.

They do not own adaptation of the older web coherence/deserialization
boundaries to the new partial helper. Before the Cycle 18 change, the helper
returned a malformed predecessor and these validators returned false; the
escaping exception is a new current-baseline interaction. No active,
archived, deferred, or rejected historical owner covers it.

### Required root fix

1. Preserve the direct helper's exact `RangeError` contract.
2. Move predecessor derivation behind previous-spending basis-kind handling,
   so `user-total` never requests a predecessor.
3. For statement/missing bases, translate the non-representable lower bound
   into `false` coherence.
4. Defensively convert any final coherence exception during deserialization
   into the standard corrupted/removal result.
5. Add regressions for:
   - direct helper error class and exact message;
   - truncated user-total lower bound;
   - truncated statement/missing lower bound;
   - deserialization of the same current-version witness;
   - a valid `0000-02 -> 0000-01` control; and
   - an invalid full-transaction year-0000 control.

## Rejected and historically owned candidates

- Cycle 18's low-year formatting, unified legacy publication identity and
  legacy schema `2.0.0`, and `.mts`/`.cts` dependency admission are otherwise
  closed and covered.
- Browser/server parser duplication, optimizer replay complexity, matcher
  scale, static-host CSP limits, storage/privacy choices, compatibility
  catalog size, and other longstanding risks retain explicit historical
  owners or deferrals.
- No new secret, injection, workflow-authority, network-boundary,
  dependency-ownership, bundle-budget, worker-leak, stale-operation, catalog
  generation, or UI accessibility failure survived review.

## Designer/browser evidence and cleanup

One isolated designer attempt used:

- session `cherrypicker-c19-designer-20260724`;
- profile `/tmp/cherrypicker-c19-designer-profile.qhvSJ9`;
- preview PID/PGID `6838/6838`, listener child `6973`, port 4189;
- browser daemon PID/PGID `12151/12151`, Chrome root `12158`.

Live evidence covered desktop/mobile semantics, skip-link and keyboard order,
theme changes, responsive navigation, RTL stress, catalog loading/error/retry,
empty dashboard/results/report states, invalid upload, a real successful
analysis, local request boundaries, layout shift, and long tasks.

Two exact owned command shells stalled during URL/console waits and were
terminated by attributed PGID only. The browser closed, the preview PTY
received Ctrl-C, all owned trees disappeared, port 4189 became free, and the
profile was moved recoverably to
`/Users/hletrd/.Trash/cherrypicker-c19-designer-profile.qhvSJ9-20260724`.
`agent-browser session list` reported no sessions, and
`bun scripts/run-e2e.ts status --assert-clean` reported a clean repository.
Unrelated interactive Chrome PID/PGID `1368/1368` and unrelated repository
processes were preserved.

## Read-only verification

Specialist and aggregation checks collectively confirmed:

- Bun 1.3.12 toolchain;
- clean domain migration;
- dependency, peer, vendor, and remote-reference ownership;
- empty dependency audit result on the review host;
- clean generated catalog/docs drift for 683 cards, 24 issuers, and 551
  optimizer-executable cards;
- passing core/web type checks;
- passing focused and whole unit/Vitest suites used by reviewers;
- passing web bundle/request budgets;
- signed Cycle 18 baseline commits and exact local/origin parity; and
- unchanged hashes for all six protected Cycle 42 artifacts.

Prompt 1 did not run the full E2E gate and did not deploy.

## Prompt 1 disposition

- `NEW_FINDINGS = 1`
- Plan required: one non-deferred correctness/reliability plan
- Deployment: none
