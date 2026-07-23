# RPF Cycle 9 — Verifier

Date: 2026-07-24
Reviewed revision: `c5c6eab9b421e547d66716e989e08c747cc36aa1`
Disposition: **verification failed**

## Inventory and verification scope

I enumerated all 2,232 tracked paths first. The active review surface comprises all 1,153 tracked non-`.context` paths: the web application and its 53 tests, parser/core/rules/viz source and tests, CLI and scraper source/tests, 16 end-to-end paths, 19 repository scripts, workflow/configuration files, 683 YAML card rules, 24 issuer READMEs, generated public catalogs, and vendored-dependency integrity metadata. Current policies and Cycle 8 plans were included; historical review bodies were not used as evidence.

I traced the recent parser-boundary, analysis-coherence, optimizer, navigation, CLI, and scraper changes from entry point through tests and observable output. Focused verification produced:

- analysis/persistence suites: 135 passed, 0 failed;
- archive/scraper/report boundary suites: 56 passed, 0 failed;
- `bun run analyze -- --help`, `bun run scrape -- --help`, and root help: passed and showed the documented options;
- toolchain, dependency, README-catalog, and generated-JSON checks: passed (683 cards, 24 issuers);
- three independent semantic-coherence probes below: **reproduced failures**.

Rejected competing hypothesis: the leading-byte workbook probe does not demonstrate an archive-budget bypass. A corrected reproduction returned:

```text
raw prefix:       [80, 75] -> preflight kind "zip"
prefixed prefix:  [0, 80]  -> preflight kind "not-zip"
direct SheetNames: ["Sheet1"]
parseXLSXBuffer transactions: 0
parseXLSXBuffer error: "헤더 행을 찾을 수 없습니다."
```

SheetJS's first-byte dispatch sends only offset-zero `PK` input to `read_zip`; leading-NUL input falls through to PRN/plaintext parsing (`node_modules/xlsx/xlsx.mjs:27239-27262`). `Sheet1` was a synthetic plaintext result, not preserved XLSX semantics, and no ZIP inflation occurred. This hypothesis is therefore not a finding.

## Findings

### VER-01 — Analysis coherence still validates optimizer aggregates against each other, not against transactions

- Severity: **Medium**
- Confidence: **High**
- Classification: **confirmed**
- Locations:
  - `apps/web/src/lib/analysis-result.ts:136-283`
  - `apps/web/src/lib/analysis-result.ts:345-385`
  - `apps/web/__tests__/analysis-result.test.ts:205-231`

The new checks reconcile assignments with `cardResults.byCategory`, then compare only total optimizer spending and broad counts with the latest positive transactions. They never derive category spending or assigned/unassigned row identity from transactions. Also, `assignments.length` is a number of card/category buckets, not a number of assigned transactions.

Two current-HEAD probes both returned `true`:

1. The only current transaction remained `category: "dining"`, while both the assignment and matching `byCategory` entry were changed to `"grocery"`. All totals balanced, so the false category allocation was accepted.
2. Three current positive rows were 5,000, 3,000, and 2,000 won. The snapshot claimed one 5,000-won assignment bucket, 5,000 won unassigned, and `unassignedTransactionCount: 1`. The only compatible remainder is two rows (3,000 + 2,000), but the snapshot was accepted because `1 assignment bucket + 1 claimed unassigned <= 3 rows`.

Concrete failure scenario: a producer regression or corrupted persisted snapshot changes both redundant category fields, or understates how many transactions earned no benefit. Deserialization accepts it and the dashboard/report presents a recommendation or disclosure that is not supported by the transaction list.

Rationale: cross-checking two derived structures catches one-sided mutations, but not jointly consistent corruption. Bucket count cannot substitute for transaction count.

Suggested fix: persist stable transaction IDs (or another exact allocation witness) on assignment buckets and derive category spending and unassigned count/spending from those IDs during coherence validation. If the persisted schema must remain aggregate-only, at minimum derive transaction category totals, reject assignment categories absent from the latest positive set, and do not claim exact mixed unassigned counts that the representation cannot prove. Add both reproductions as regression tests.

### VER-02 — Cap disclosures are structurally validated but semantically unaudited

- Severity: **Medium**
- Confidence: **High**
- Classification: **confirmed**
- Locations:
  - `apps/web/src/lib/persistence.ts:231-280`
  - `apps/web/src/lib/analysis-result.ts:136-283`
  - `apps/web/__tests__/store-persistence.test.ts:590-632`

Persistence checks only that cap fields have the expected primitive types. `isOptimizationCoherent` does not inspect `capsHit`, `byCategory.capReached`, or `byCategory.capAmount`.

An otherwise coherent snapshot was accepted with:

```text
byCategory: dining, capReached=false
capsHit: grocery, capAmount=999, actualReward=1, appliedReward=9999
```

That cap names a category absent from the card result, applies more than the uncapped reward, contradicts `capReached`, and is unrelated to the reported 500-won total reward.

Concrete failure scenario: a stale or malformed snapshot shows a cap warning for the wrong category, claims an impossible cap computation, or hides a reached cap. Users then make a card choice based on a disclosure that passed the repository's advertised semantic-coherence boundary.

Suggested fix: require `appliedReward <= actualReward`, connect category caps to exactly one `byCategory` entry, reconcile `capReached`/`capAmount` with `capsHit`, and define explicit rules for `monthly_total` caps. Add negative tests for unknown categories, impossible reward ordering, duplicate cap records, and flag/detail contradictions.

## Final missed-issues sweep

I repeated edge sweeps over empty/all-unassigned results, transaction truncation provenance, replacement-card normalization, balanced cross-card mutations, monthly periods, safe-integer arithmetic, parser format mismatches, SheetJS archive dispatch, scraper help/runtime parity, generated-data identity, navigation query/fragment handling, and existing regression coverage. Previously fixed findings stayed fixed. No additional independently reproducible issue was retained after deduplication.
