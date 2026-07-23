# Review-plan-fix Cycle 11 — test engineer

- Date: 2026-07-24
- Reviewed revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Scope: test architecture, active server/browser entry paths, focused
  reproduction, coverage gaps, and historical duplicate control

## Outcome

Both same-cycle raw candidates are independently confirmed:

| Existing ID | Severity | Confidence | Test-engineer disposition |
|---|---:|---:|---|
| `C11-CR-001` | Medium | High | Confirmed through the canonical helper, generic CSV/JSON, CLI `parseStatement`, browser-compatible CSV/JSON, and web `parseFile` entry paths |
| `RPF11-PERF-001` | Medium | High | Confirmed as a new constant-factor regression inside the already-known linear matcher architecture |

No additional genuinely new current-HEAD defect survived reproduction and
historical deduplication. I therefore do not assign a third Cycle 11 ID merely
to the missing regression/benchmark guards described below.

## Test inventory and architecture

The pinned tree contains 2,274 tracked paths, of which 1,161 are active after
excluding `.context`. The runnable automated-test inventory is:

| Test family | Files | Direct `test` / `it` definitions |
|---|---:|---:|
| Web unit and framework-free contract tests | 55 | 600 |
| Core | 14 | 218 |
| Parser | 23 | 1,404 |
| Rules/catalog | 7 | 107 |
| Visualization/reporting | 3 | 20 |
| CLI | 10 | 90 |
| Scraper | 10 | 87 |
| Repository scripts/workflow/process controls | 8 | 69 |
| Playwright E2E specifications | 10 | 104 |
| **Total** | **140** | **2,699** |

Parameterized cases expand beyond the static definition count. A fresh direct
run of the three candidate-relevant workspaces executed 2,607 tests across 92
files.

The root `test` command delegates workspace suites to Turbo/Bun and then runs
the repository-script suite. Playwright is deliberately separate behind
`scripts/run-e2e.ts`, which owns its server, port, and process lifecycle.
Browser workers and state boundaries also have framework-free unit tests with
injected worker/file dependencies, allowing most parser and analyzer behavior
to be exercised without starting Astro or a browser.

Coverage is strong around individual amount syntaxes, server/browser parser
parity, non-spending rejection, parser workers and diagnostics, merchant
boundary correctness, categorization-to-reward behavior, optimizer
determinism, catalog contracts, and process ownership. The two confirmed
candidates sit between those examples: sign-composition closure is missing
from the parser matrix, and the boundary-correctness suite has no cost or
operation-count guard.

## Entry-path trace

### Amount parsing

The canonical kernel is
`packages/parser/src/shared/amount.ts:7-63`. Server/CLI parsing reaches it
through:

1. `tools/cli/src/parse-statement.ts:43-60`;
2. `packages/parser/src/statement.ts:48-138`;
3. the selected CSV/JSON/XLSX/HTML/OFX/PDF adapter; and
4. `parseAmount()` / `parseAmountString()`.

The browser-compatible export is
`packages/parser/src/browser.ts:22`. Web parsing reaches it through
`apps/web/src/lib/parser/amount.ts:1-7`, the format adapters, and
`apps/web/src/lib/parser/index.ts:25-112`. When workers are available,
`apps/web/src/lib/parser/worker-runner.ts:37-64` dispatches CSV, XLSX, JSON,
OFX, and HTML to format-specific workers; those workers call the same
adapter/kernel boundary. The non-worker fallback follows the same format
adapters directly.

### Merchant matching

Browser files are parsed first, then
`apps/web/src/lib/analyzer.ts:78-109,143-180,292-337` synchronously maps parsed
transactions through one shared `MerchantMatcher` before optimizer-worker
dispatch. CLI analyze/optimize/report commands likewise instantiate
`MerchantMatcher` and categorize locally.

`MerchantMatcher.match()` first scans the canonical taxonomy, then the 12,047
static substring entries in both directions on a unique miss, and finally
enters `CategoryTaxonomy.findCategory()`, which repeats taxonomy substring and
reverse-fuzzy scans. The 500-entry LRU helps repeated names, not a statement
containing many distinct descriptions.

## Independent confirmation: `C11-CR-001`

### Reproduction

A direct current-HEAD probe returned:

```text
parseAmountString("-1000-")        =>  1000
parseAmountString("마이너스-1000")  =>  1000
parseAmountString("－1000-")        =>  1000
parseAmountString("마이너스－1000") =>  1000

parseAmountString("-1000")         => -1000
parseAmountString("1000-")         => -1000
parseAmountString("마이너스1000")   => -1000
parseAmountString("(-1000)")       => -1000
```

The concrete generic CSV:

```csv
date,merchant,amount
2026-01-15,REFUND,-1000-
```

produced one transaction with `amount: 1000` and no diagnostic. The same
positive transaction/no-error result was independently reproduced through:

- package `parseGenericCSV`;
- package `parseJSON` with a string amount;
- dependency-injected `parseStatement("statement.csv", ...)`, which exercises
  the server/CLI dispatcher without writing a fixture;
- the browser-compatible web CSV and JSON adapters; and
- `parseFile(new File(..., "statement.csv"))`, the web file-dispatch boundary.

This confirms product reach and shows why downstream non-spending guards do
not help: they receive an apparently valid positive safe integer.

### Missing guard

Current tests separately cover native/full-width leading minus,
Korean-minus, trailing-minus, ordinary accounting parentheses, and the fixed
`(-1234)` case. They do not combine native/full-width leading minus with the
other accepted negative decorators. Server/browser parity tests also compare
the same shared wrong result, so parity alone cannot express the sign
invariant.

Recommended regression structure:

1. Add a table-driven canonical-kernel matrix for supported sign decorators,
   including ASCII/full-width leading minus combined with trailing-minus and
   Korean-minus.
2. State the invariant explicitly: a string accepted as a composition of
   negative markers may remain negative or be rejected as redundant, but must
   never become positive.
3. Add generic CSV and JSON boundary cases that require either a non-spending
   diagnostic or omission, never a positive transaction.
4. Retain public server/browser entry-point checks, but do not duplicate the
   entire kernel matrix in the web wrapper now that both use the canonical
   implementation.

## Independent confirmation: `RPF11-PERF-001`

### Reproduction

Runtime inspection of a production-corpus matcher found:

```text
static substring entries: 12,047
taxonomy keyword entries:    324
```

For a unique complete miss, the current control flow invokes
`normalizedMerchantTermMatches()` approximately 25,066 times:

- 324 initial taxonomy comparisons;
- 12,047 static entries in both directions; and
- another 324 taxonomy substring comparisons plus 324 reverse-fuzzy
  comparisons in the fallback.

Every invocation recomputes leading and trailing ASCII-boundary flags with two
regular-expression tests before the first `indexOf`, even though authored-term
flags are immutable. That is about 50,132 up-front boundary-regex tests per
unique complete miss, excluding neighbor checks after actual substring hits.

An independent three-sample real-`MerchantMatcher` probe on this host measured
the following post-construction medians:

```text
  100 unique misses:  60.6 ms
  500 unique misses: 300.4 ms
1,000 unique misses: 612.6 ms
```

The absolute values are lower than the performance review's separate probe,
but they independently reproduce the synchronous linear growth and material
main-thread cost.

A bounded zero-hit differential over 12,047 terms and 300 unique merchants
(3,614,100 merchant/term pairs, both directions) measured:

```text
current repeated boundary predicates: 156.2 ms
precomputed flags + character checks:   93.5 ms
ratio:                                  1.67x
hit counts:                             0 / 0
```

This controlled zero-hit comparison is not a replacement implementation or a
full semantic proof. It isolates that precomputing the immutable metadata and
delaying boundary checks until after `indexOf` finds a candidate removes
measurable work while preserving the tested zero-hit result.

### Missing guard

The Cycle 10 merchant-boundary tests correctly protect `CU`, `KT`, and `SKT`
behavior through static keywords, taxonomy keywords, merchant allowlists, and
category-only rewards. No test directly constrains the operation cost of
`normalizedMerchantTermMatches`, the construction-time ownership of boundary
metadata, or a current-corpus unique-miss budget.

Recommended regression structure:

1. Compile normalized term text plus leading/trailing boundary flags once and
   test the compiled representation directly.
2. Run a deterministic differential corpus over every authored term plus
   prefix/suffix, punctuation, case, NFKC, and unknown mutations to preserve
   Cycle 10 semantics.
3. Prefer a deterministic operation-count/compiled-metadata assertion over a
   tight wall-clock unit threshold.
4. Keep one coarse benchmark at the Plan 72 public boundary (1,000 unique
   misses), with generous host-aware reporting, to detect a future
   multiplicative regression.
5. Preserve the separate deferred `D-C1-041` exit criteria for eliminating the
   underlying all-keyword scans; fixing repeated boundary metadata does not
   close that architectural debt.

## Duplicate control

- Historical Cycle 40/42 reports cover the exact parenthesized
  double-negative `(-1234)`, and current tests prove that case is fixed.
  Searches across current/archived plans, reviews, and tests found no prior
  `-1000-`, `마이너스-1000`, or equivalent leading-minus composition. The
  parser failure is therefore valid as `C11-CR-001`, but it is not renamed as
  a test-engineer finding.
- `D-C1-041`, Cycle 9 measurements, and earlier categorizer reports already
  cover linear full-corpus scans. `RPF11-PERF-001` is narrower: commit
  `6cbafb3` added repeated regex-derived boundary metadata inside each
  comparison. This review confirms that new constant-factor regression
  without claiming the old scan architecture as new.
- Existing reports already cover broad property-based amount-test wishes and
  the compiled matcher redesign. They remain useful test strategies, not
  separate Cycle 11 defects.
- The rejected prefixed-XLSX/ZIP-inflation hypothesis was not revived.

## Tests and probes run

All commands were non-browser and did not start a server:

- Focused amount/parser matrix: **64 passed, 0 failed** across five files.
- Focused categorizer/analyzer matrix: **84 passed, 0 failed** across five
  files.
- Fresh direct core/parser/web matrix: **2,607 passed, 0 failed** across 92
  files.
- Root `bun run test`: exit 0; Turbo reported **12/12 successful tasks**, and
  the repository-script phase reported **71 passed, 0 failed**. Some workspace
  output was replayed from Turbo cache, which is why the fresh direct matrix
  above was also run.
- Direct helper, generic CSV/JSON, injected `parseStatement`, browser-adapter,
  web `parseFile`, real-matcher, and controlled zero-hit probes all completed
  successfully and produced the evidence recorded above.

Playwright/E2E was intentionally not run because this role was expressly
forbidden from starting a browser or server. Existing E2E specifications were
inventoried and inspected statically.

## Closing sweep and provenance

The final missed-issue sweep revisited amount normalization and non-spending
admission, format dispatch and worker parity, parser diagnostic behavior,
categorizer exact/substring/reverse precedence, LRU behavior, analyzer and CLI
entry paths, optimizer handoff, data/publication tests, and the root test
orchestration. With the complete affected unit matrix green, no additional
current failure met the threshold for a new finding.

Final process/repository checks:

- `bun scripts/run-e2e.ts status --assert-clean` passed.
- TCP 4173 had no listener.
- No browser or server was launched by this role.
- HEAD and branch remained unchanged.
- No source, test, plan, generated artifact, staging, commit, push, or
  deployment change was made.
- The only path written by this role is
  `.context/reviews/2026-07-24-rpf-cycle11-test-engineer.md`.

The six protected untracked Cycle 42 artifacts remained untracked and
unstaged with byte-identical SHA-256 hashes:

| Path | SHA-256 |
|---|---|
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` |
