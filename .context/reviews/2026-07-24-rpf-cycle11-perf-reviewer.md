# Review-plan-fix Cycle 11 — performance reviewer

- Date: 2026-07-24
- Reviewed commit: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: CPU and allocation growth, main-thread responsiveness, concurrency,
  cancellation/backpressure, worker/resource lifecycle, I/O bounds, rendering
  scale, and cross-file runtime behavior

## Inventory and coverage

The locked snapshot contains 2,274 tracked paths. Its sorted manifest SHA-256
is `8b15dbfc1093940063f141c9fb28442f628d4a333579a31b71aba87b93201ac5`.
After excluding 1,113 historical `.context` paths, the 1,161-path active
manifest has SHA-256
`bfa6a661e70aca250527b7efe58e91a4c655521dc861b076d6333e5af1b03b41`.
The active inventory comprises 168 web paths, 42 core paths, 86 parser paths,
734 rules paths, 14 visualization paths, 28 CLI paths, 35 scraper paths, 19
scripts, 16 E2E paths, and 19 root/config/workflow/vendor/other paths. It
includes 686 YAML and 59 JSON artifacts.

I first inventoried every performance/concurrency-relevant tracked family:

- all web upload, admission, quick-detection, two-lane queue, browser parser
  and parser-worker paths; categorization, analysis context/result/replacement,
  optimizer protocol/runner, catalog loading/caching, persistence, operation
  epochs, navigation, every Svelte renderer/page/layout, public catalog/detail
  shard, and their unit/integration tests under `apps/web`;
- every calculator, categorizer, keyword corpus, optimizer, model, numeric,
  analysis-context, and test path under `packages/core`; every CSV, XLSX, JSON,
  HTML, OFX, PDF, encoding/detection/adapter, archive-budget, and test path
  under `packages/parser`; every schema, loader, catalog validator, publication
  contract, browser projection, 683-card authored corpus, generated catalog,
  category/issuer artifact, and test path under `packages/rules`; and every
  report/terminal generator and test under `packages/viz`;
- every command, local/remote input, catalog, output, batch, consent, and test
  path under `tools/cli`; every network-policy, fetch, extraction, prompt,
  schema, writer, CLI, and test path under `tools/scraper`; all build,
  publication, dependency, bundle-budget, migration, README-catalog, and
  process-control scripts; E2E fixtures/configuration; manifests, lockfile,
  workflow, vendor policy, and root configuration.

The 1,113 tracked plans/reviews were searched before classification. I read the
current/archived performance reports, Cycle 10 aggregate and implementation
plans, deferred plan 72, and all candidate-specific matches. Thus the finding
below is limited to the new per-comparison regression introduced after the
Cycle 9 measurement; it does not relabel the already deferred linear matcher
architecture (`D-C1-041`). I also did not repeat `D-C1-040`, transaction-table
virtualization, persistence serialization, streaming/whole-workbook parsing,
large-PDF text assembly, parser diagnostic amplification, or optimizer catalog
cloning. The previously rejected prefixed-XLSX inflation hypothesis was not
resurrected.

## RPF11-PERF-001 — boundary metadata is recomputed for every keyword comparison, multiplying synchronous categorization time

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **New boundary predicate:** `packages/core/src/categorizer/normalize.ts:16-58`
- **Repeated callers:** `packages/core/src/categorizer/matcher.ts:54-63,163-170,187-259`;
  `packages/core/src/categorizer/taxonomy.ts:51-68,146-193,195-244`
- **Main-thread reach:** `apps/web/src/lib/analyzer.ts:78-109,143-180,286-337`
- **Admitted input envelope:** `apps/web/src/lib/upload-admission.ts:3-5`

Commit `6cbafb3` correctly replaced raw substring checks with
`normalizedMerchantTermMatches()` so short ASCII aliases such as `CU`, `KT`,
and `SKT` do not match inside unrelated words. However, the helper tests the
first and last character of the already-normalized term with regular
expressions on every invocation. A unique miss invokes it for each taxonomy
keyword and then for both directions of every static substring entry. The
leading/trailing requirements are immutable properties of each authored term,
but neither `CategoryTaxonomy` nor `MerchantMatcher` stores them when it builds
its keyword collections. Even a no-hit comparison therefore pays two regex
tests before its first `indexOf`; reverse matching repeats the work. The
500-entry LRU only helps repeated merchant labels.

Two executable Bun 1.3.12 probes on the current host confirmed the regression:

```text
Current MerchantMatcher, five-sample median after warm-up
  100 unique misses:    87.8 ms
  500 unique misses:   648.6 ms
1,000 unique misses: 1,496.7 ms
2,000 unique misses: 2,629.7 ms

Isolated 12,065-term corpus, 1,000 unique no-hit merchants
(12,065,000 merchant/term pairs; both directions; five-sample median)
prior includes predicates:           460.9 ms
current boundary-aware predicates: 2,069.2 ms
ratio:                                  4.49x
```

The isolated predicates returned the same zero-hit result. This comparison
does not attribute the pre-existing full scans to a new finding; it isolates
the post-Cycle 9 predicate cost inside those scans. As a second reference,
Cycle 9 recorded the same end-to-end miss scales before this change at 32.3,
119.2, 239.9, and 465.5 ms. Current keyword-boundary and categorizer suites
still pass (52 tests), confirming that the correctness behavior is intentional
and must be preserved.

Concrete scenario: a valid CSV export contains 1,000–2,000 distinct statement
descriptions that match no authored merchant, while remaining well below the
10 MiB per-file and 50 MiB aggregate limits. Parsing happens in workers, but
`parseAndCategorize()` resumes on the window thread and synchronously maps all
transactions through the shared matcher before the optimizer worker is
started. On the current host, that newly inflated predicate work alone holds
the application thread for about 1.5–2.6 seconds. The two parse lanes and their
event-loop yield occur only after each file's categorization completes, so they
do not keep input, animation, or cancellation responsive during this span.

Root fix: compile each normalized term once into a record containing its text
and leading/trailing ASCII-boundary flags when `CategoryTaxonomy.keywordMap`
and `MerchantMatcher.substringEntries` are constructed. Match against those
records with a cheap character-code boundary predicate only after `indexOf`
finds a candidate occurrence; compile the normalized merchant flags once for
the reverse direction. Preserve the Cycle 10 boundary differential tests and
add a current-corpus unique-miss benchmark/operation guard. The eventual
multi-pattern and reverse-candidate index required by `D-C1-041` should still
remove the underlying full scans, but it is not necessary to eliminate this
new constant-factor regression.

## Verification and final sweep

- The Cycle 10 boundary and categorizer suites passed: 52 tests, 0 failures.
- A competing repeated-sort hypothesis was rejected rather than reported.
  Instrumenting `compareRewardRelevantTransactions` sorts during a real
  682-card/400-transaction optimizer run found 14,302 canonical sorts over
  229,172 aggregate elements, but only 3.6 ms of sort time in a 1,907.8 ms run
  (0.2%). Equal-amount stress raised that to 50.8 ms of 1,575.2 ms (3.2%).
  This does not clear a separate-finding threshold and remains part of the
  already deferred optimizer work.
- The final missed-issue sweep revisited all active nested loops, sorts,
  clones/transfers, JSON transforms, caches, reactive collections,
  timer/listener/worker ownership, abort paths, queue release/yield behavior,
  response/file/archive budgets, CLI/scraper I/O, and generated-data checks.
  Worker and abort listeners, timers, parser/PDF resources, request
  controllers, and owned workers had matching cleanup paths. No second new,
  non-duplicate issue met the evidence threshold.
- No browser/E2E run, product source/test/plan/generated-artifact edit,
  staging, commit, push, or deployment was performed. The six pre-existing
  untracked Cycle 42 artifacts remained untracked and unstaged.

Final count: **1 new performance finding — 1 Medium (High confidence,
Confirmed).**
