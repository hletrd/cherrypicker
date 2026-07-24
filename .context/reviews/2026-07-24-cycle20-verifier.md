# Review-plan-fix Cycle 20 — verifier

## Verification result

Reviewed revision:
`c59938ee5ca5b0c5756e34907330a4eacd2898f9`.

The current implementation has **zero genuinely new Cycle 20 roots** from the
verifier lens. One current Low-severity defect is confirmed, but historical
reconciliation assigns it to the completed Plan 109 persistence-coherence
contract:

- **C20-B-001 / Plan 109 regression — Low severity, High confidence,
  confirmed:** truncated semantic validation accepts a monthly bucket with
  positive spending and zero transactions, restores it from current-version
  persistence, and lets the dashboard include the phantom amount in its
  all-month total.

Cycle 18/19 calendar, publication-identity, and dependency-extension repairs
otherwise verify cleanly. This was a review-only pass: no implementation,
plan, commit, push, browser, E2E, or deployment action was performed.

## Complete verification inventory

The inventory covered all **2,424 tracked paths**, split into 1,172 active
paths and 1,252 historical `.context` records. Within the active tree, the
verifier content-scanned 208 production/config source paths, 181 test/E2E
support paths (148 executable test/spec files), and 764 data, documentation,
generated-artifact, and fixture paths.

Verification traces covered:

1. upload limits and file identity through parser detection, encoding,
   worker transfer, categorized transactions, strict calendar projection,
   performance basis, optimizer output, disclosures, persistence, restore,
   editing, and reoptimization;
2. authored YAML through schema/rule semantics, availability, generated
   legacy and browser projections, publication hashes, runtime readers, CLI
   compiled catalog, issuer documentation, and bundle budgets;
3. command parsing, remote-PDF consent, scraper runtime configuration,
   allowed-host/DNS/address checks, redirects, bounded streams, extraction
   normalization, and exclusive/atomic output;
4. analysis replacement/reset operation ownership, card-loader caches,
   navigation state, report/terminal sinks, static-host security claims, and
   UI consumers of derived facts;
5. manifests, lock/vendor integrity, source-extension discovery, TypeScript
   parser admission, Turbo/Bun/Vitest/Playwright topology, workflow gates, and
   exact E2E ownership/cleanup code.

The complete tracked review/plan index was searched before assigning novelty.
Tests and comments were used as hypotheses only; the result below was
established from current source and a direct runtime witness.

## C20-B-001 — truncated monthly fact validation admits a phantom bucket

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed**
- Classification: **completed Plan 109 contract gap; not a new Cycle 20 root**
- Producer:
  `packages/core/src/analysis/context.ts:137-175,189-205`
- Pure coherence:
  `apps/web/src/lib/analysis-result.ts:926-984`
- Persistence:
  `apps/web/src/lib/persistence.ts:127-198,800-844,867-925`
- Restored UI:
  `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`
- Current test boundary:
  `apps/web/__tests__/analysis-result.test.ts:667-843`;
  `apps/web/__tests__/store-persistence.test.ts:620-720,1756-1769,2121-2142`
- Historical owner:
  `.context/plans/_archive/109-cycle8-analysis-coherence.md:7-35`

### Source proof

The canonical producer inserts a bucket only while visiting a valid
transaction and increments its count unconditionally. Positive spending with
zero transactions is therefore outside the producer domain.

The truncated validator admits it because its per-entry count check is:

```text
safe integer and transactionCount >= 0
```

rather than positive. The count contributes zero to the represented total.
For previous-month provenance, the same map is queried with `count > 0`, so a
zero-count bucket is treated as absent even though its spending remains in the
stored breakdown. Persistence repeats the nonnegative count shape check and
then delegates to that pure validator.

### Exact runtime witness

Starting from an otherwise coherent current-version truncated snapshot:

```json
{
  "_truncatedTxCount": 1,
  "totalTransactionCount": 1,
  "monthlyBreakdown": [
    {
      "month": "2026-06",
      "spending": 777777,
      "transactionCount": 0
    },
    {
      "month": "2026-07",
      "spending": 10000,
      "transactionCount": 1
    }
  ],
  "previousSpendingBasis": {
    "kind": "missing-calendar-month",
    "month": "2026-06",
    "assumedAmount": 0
  }
}
```

Current-baseline observations:

```text
isAnalysisResultCoherent(snapshot, { truncatedTransactionCount: 1 })
  => true

deserializeAnalysis(JSON.stringify(snapshot))
  => data present, warningKind "truncated", shouldRemove false
```

The restored `monthlyBreakdown` preserves both entries. `SpendingSummary`
calls `sumMonthlySpending()` over the array, showing an extra 777,777 won in
the all-month figure while the total transaction count is still one and the
previous-month disclosure says June was missing.

### Failure scenario

A current-version payload is manually altered, left by a buggy same-version
writer, or otherwise corrupted after honest transaction truncation. Because
the omitted raw rows cannot disprove the monthly facts, the semantic validator
is the last integrity boundary. It accepts mutually contradictory spending,
count, and provenance and the application renders the wrong restored total.

Fresh analysis cannot create this state, and no ordinary upload path was found
that does so. The issue is therefore Low severity rather than a general
calculation defect.

### Required repair

Make `transactionCount > 0` part of the monthly bucket domain in both
`hasCoherentTruncatedFacts()` and persisted shape admission. Do not require
positive spending: a real month containing only zero/non-positive rows has
`spending === 0` and a positive transaction count. Add:

1. a pure-coherence rejection for a phantom prior bucket;
2. a current-version deserializer rejection for the same payload;
3. a valid zero-spending, positive-count previous-month control; and
4. an honest truncation round-trip control.

## Historical classification

Plan 109 did not merely request generic hardening. It explicitly required:

- monthly count/spending summary coherence;
- exact handling of intentionally truncated snapshots;
- atomic rejection of contradictory derived fields; and
- agreement of every stored derivation with the snapshot that produced it.

C20-B-001 is a missed relational case within that exact promise. It is an
actionable current defect and a repair obligation, but reporting it as a new
Cycle 20 root would double-count the historical persistence-coherence issue.

The old untracked Cycle 42 artifacts remain protected and unchanged. Their
numeric finiteness and empty-month observations do not own this distinct
positive-spending/zero-count contradiction.

## Verification of Cycle 18/19 repair surfaces

### Calendar and validation totality

`YearMonth` is still opaque and constructed through runtime refinement.
Successful predecessors remain inside `YYYY-MM`; January 1000 selects
December 0999; `0000-01` retains its explicit public `RangeError`.

Current web validation is basis-aware:

- `user-total` performs no predecessor calculation;
- statement/missing bases at the lower bound return false; and
- persistence converts an unexpected final coherence exception into the
  normal corrupted/removal result.

Focused tests for these paths pass. C20-B-001 is adjacent only because it also
uses truncated facts; it does not reopen the Cycle 18/19 calendar root.

### Publication identity

Identity-free legacy full, legacy compact, browser summary, optimizer,
categories, and detail projections still participate in the keyed canonical
publication input before metadata injection. Data verification found no
generated drift; 683 authored cards across 24 issuers produce 551 executable
browser entries.

### Dependency ownership

Source discovery still includes `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`,
`.mts`, and `.cts`, with configuration admission derived from the same
extension set. The dependency, peer, remote-reference, and vendored-archive
check passes.

## Evidence executed

| Verification | Result |
| --- | --- |
| Analysis coherence + persistence suites | 215 pass, 0 fail, 543 expectations |
| Web type/lint diagnostics (`astro check`) | 126 files; 0 errors, 0 warnings, 0 hints |
| Dependency/peer/vendor check | pass |
| Data + documentation drift check | pass |
| Direct phantom-bucket coherence probe | accepted, confirming defect |
| Direct phantom-bucket deserializer probe | restored as truncated, confirming defect |
| Protected artifact SHA-256 check | all six unchanged |

No browser gate was needed to establish this data-layer defect. In accordance
with the user's process-hygiene requirement, this role started no Playwright,
Chrome, preview server, profile, session, or port owner.

## Rejected competing hypotheses

- Full transaction-backed snapshots do not share the gap: the exact month map
  rejects an added or altered bucket.
- A zero-spending bucket is not itself invalid; the count, not spending, is
  the producer-domain discriminator.
- Reordering valid monthly buckets does not change current dashboard totals
  or coherence and is already historically owned as a producer ordering
  contract, so it was not promoted.
- Ordinary parser years remain intentionally narrower than the shared
  `YearMonth` grammar; that policy mismatch is documented and unchanged.
- Catalog mixed-generation, unsupported-card execution, stale worker commit,
  remote-fetch authority, CLI empty-success, report escaping, and dependency
  extension candidates either verify correct or retain explicit historical
  owners.

## Cross-agent-likely overlap and final sweep

C20-B-001 is expected to overlap the critic and test-engineer reports and may
also appear in code-reviewer/debugger/tracer/architect work. Deduplicate every
copy to the Plan 109 repair obligation; the missing test is not an independent
root.

The final sweep rechecked all active files and historical owners for malformed
primitive and relational facts, numeric overflow, zero/negative count domains,
month gaps/order, calendar underflow, truncation completeness, selected-card
scope, cap-loss identity/arithmetic, parser direction/encoding, file/network
bounds, cancellation, cache generation, unsafe rendering, CI runner
inclusion, skipped/conditional tests, and exact resource cleanup.

Final verifier disposition:

- Genuinely new Cycle 20 findings: **0**
- Confirmed current Plan 109 repair obligations: **1**
- Unresolved manual-only risks promoted: **0**
