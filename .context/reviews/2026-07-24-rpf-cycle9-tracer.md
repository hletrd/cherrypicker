# Review-plan-fix Cycle 9 — tracer

- Date: 2026-07-24
- Baseline: `c5c6eab9b421e547d66716e989e08c747cc36aa1`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: causal tracing, competing hypotheses, provenance, ordering, and
  cross-file state transitions

## Inventory and trace coverage

I enumerated all 2,232 tracked paths before tracing active flows: 166 web
paths; 870 core/parser/rules/viz paths; 63 CLI/scraper paths; 19 scripts; 16
E2E paths; 19 root/config/workflow/vendor paths; and 1,079 historical
plan/review paths used for duplicate/fix-state checks. Every active
source/test/config/data/doc family was included, including 159 tracked
test/spec paths, 683 authored card-rule YAML files, generated browser
artifacts, and the full parser fixture corpus. Six protected untracked Cycle
42 files were not touched.

The trace followed browser and CLI inputs through format routing, parser
workers, ordered merge, transaction identity, categorization, calendar and
performance provenance, greedy scoring, persistence, manual edits,
terminal/HTML rendering, catalog publication, scraper output, and
failure/cancellation branches. Plans 108–113 and prior findings were checked
before the final sweep.

## RPF9-TRACE-001 — an unresolved transaction tie makes rewards depend on file/input order

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Incomplete deterministic comparator:**
  `packages/core/src/optimizer/greedy.ts:350-359`
- **Stateful consumer:** `packages/core/src/optimizer/greedy.ts:366-408`
- **Browser order/identity provenance:**
  `apps/web/src/lib/analyzer.ts:73-104,315-332,345-380`

The optimizer sorts transactions by amount, merchant, and date. If two
transactions share all three values but differ in another reward-relevant
fact—category, subcategory, channel, payment type, fuel volume, or a
condition-bearing memo—the comparator returns zero. Stable sort then preserves
caller order. Greedy scoring commits cap/occurrence state after each row, so
the surviving order is observable in later marginal rewards.

The web path does not canonicalize this tie. Parser outcomes are consumed in
the uploaded file order, transactions are appended in that order, and IDs use
the file index. Selecting the same files in the opposite order therefore
changes both the tie order and the order-derived IDs.

An executable two-card probe used two 10,000-won transactions with the same
date and merchant:

```text
dining,grocery -> totalReward=900
  dining -> card a, 500
  grocery -> card b, 400

grocery,dining -> totalReward=500
  grocery -> card a, 500
  dining -> unassigned, 10,000 won
```

Card A paid 10% dining / 5% grocery with a 500-won global cap; card B paid 4%
grocery. Only input order changed. This is a residual boundary missed by the
C32-V12 fix: merchant and date are secondary keys, but they do not totally
order transactions with distinct reward facts.

### Competing hypotheses checked

1. **Modern stable sort makes the result deterministic.** It makes a given
   input array repeatable, but deliberately preserves the input-order
   difference; it does not make permutations equivalent.
2. **Transaction ID is a final tie-breaker.** The comparator never reads it.
   In the web flow, the ID is also derived from file order, so adding it alone
   would preserve the defect.
3. **Equal amount/date/merchant implies reward equivalence.** False: the
   calculator consumes category/subcategory, merchant, channel, payment type,
   fuel volume, installments, memo, and exclusion facts.
4. **Only presentation order changes.** False: the probe changed modeled
   reward from 900 to 500 won and changed assigned versus unassigned spending.

**Concrete scenario:** two uploaded exports contain same-day, same-amount
transactions whose normalized merchant text is equal but whose bank category
or online/offline fact differs. Reversing the file selection order can change
the recommended card, cap consumption, unassigned spending, and promised
savings without any data change.

**Root-cause fix:** define a total comparator over every immutable
reward-relevant transaction fact, using ASCII/canonical serialization rather
than locale-dependent or file-index-derived identity. If all reward facts are
equal, their order is semantically interchangeable; use a content-derived
duplicate ordinal only for telemetry identity. Add permutation tests with
category, subcategory, channel, payment type, occurrence limits, fixed-per-day
benefits, category caps, and global caps, and assert full
`OptimizationResult` equality.

## Rejected trace: prefixed ZIP does not reach archive inflation

The investigated path was:

`preflightXLSXArchive()` (`packages/parser/src/shared/xlsx-archive.ts:118-130`)
→ server/browser XLSX entry points
(`packages/parser/src/xlsx/index.ts:106-137`;
`apps/web/src/lib/parser/xlsx.ts:109-151`) → SheetJS.

A leading zero makes preflight report `not-zip`, but the executable probe
showed SheetJS parsing the bytes as plaintext/PRN, not as an XLSX archive. The
returned sheet contained raw ZIP gibberish and the product parser rejected it
for missing headers. Thus “SheetJS returned a workbook object” was not
evidence of ZIP inflation or valid XLSX semantics, and the proposed archive
budget bypass was rejected.

## Verification and final sweep

- The order-permutation probe reproduced 900 versus 500 won from the same
  transaction facts.
- 170 focused tests passed; existing optimizer tests cover card-order
  determinism but not tied transaction permutations.
- The final trace revisited amount/date/merchant provenance, multi-file order,
  transaction IDs, mixed/partial file outcomes, cancellation epochs, worker
  ownership, cap/occurrence state, persistence truncation, bank/format
  metadata, catalog hash identity, scraper/report output, and recent Cycle 8
  changes.
- No product source, generated artifact, protected Cycle 42 path, commit, or
  deployment was changed.

Final count: **1 Medium confirmed finding**.
