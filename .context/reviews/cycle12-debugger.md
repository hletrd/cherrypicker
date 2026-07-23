# Review-plan-fix Cycle 12 — debugger

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **all eight requested candidates reproduced; no genuinely new
  debugger finding**
- Final count: **0 additional findings**
- Scope: review and this report only; no implementation, source/test/plan/
  generated-artifact change, staging, commit, push, deployment, server,
  browser, or E2E run

## Inventory and method

I locked the pass to the exact revision above and inventoried all **2,291
tracked paths**: **1,129** tracked `.context` paths and **1,162** active
product, data, test, documentation, workflow, configuration, and
vendor-integrity paths.

| Family | Tracked paths |
| --- | ---: |
| `apps/web` | 168 |
| `packages/core` | 43 |
| `packages/parser` | 86 |
| `packages/rules` | 734 |
| `packages/viz` | 14 |
| `tools/cli` | 28 |
| `tools/scraper` | 35 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/config/workflow/vendor/other | 19 |

Every current and archived `.context` item was read or indexed before
classification. High-volume authored and generated data was followed through
its schema, semantic validator, publication, identity, and runtime-consumer
boundaries. The executable sweep traced parser admission and diagnostics,
categorization, calculator and optimizer state, analysis replacement and
coherence, workers, persistence, file-parse queues, CLI consent and output,
scraper fetch/extract/quarantine/write paths, terminal/HTML/browser sinks, and
the post-Cycle-11 repair surface.

The eight named hypotheses were challenged with isolated, read-only runtime or
static probes. A confirmation below does not receive a debugger ID when a
same-cycle or historical report already owns the root cause.

## Requested candidate validation matrix

| Candidate | Debugger disposition | Ownership and count |
| --- | --- | --- |
| Shared `capGroup` identity/coherence | **Confirmed.** Validator-accepted fixtures produce order-dependent totals and cross-suppress distinct daily rules. | `C12-CR-001`; **0 debugger-new** |
| Standalone report cap label | **Confirmed.** A per-transaction event is rendered as a monthly cap. | `C12-CR-002`; **0 debugger-new** |
| Scraper whitespace fallback | **Confirmed.** A whitespace-only first selector hides populated later content and reaches request construction as an empty string. | `C12-CR-003`; **0 debugger-new** |
| CLI buffer amplification | **Confirmed.** The wrapper and parser seam allocate independent statement-sized buffers. | `RPF12-PERF-001`; **0 debugger-new** |
| Source-hostname contrast | **Confirmed.** The strongest Shinhan header tint gives the muted hostname about 3.67:1 contrast. | `RPF12-D-001`; **0 debugger-new** |
| Unnamed CardGrid SVG | **Behavior confirmed; Cycle 12 novelty rejected.** The search glyph lacks hidden or named semantics, but this is another pre-existing site of the Cycle 9 decorative-SVG root cause. | Reopen/merge `C9-D-01` / `C9-011`; **0 debugger-new** |
| Root `parse` script | **Confirmed.** Help and a nonexistent input both execute an export barrel and exit zero without doing a parse. | `RPF12-DOC-001`; **0 debugger-new** |
| Scraper “official URL” wording | **Confirmed.** Prompt/test wording says the boundary records `url`; runtime quarantine deletes it and stamps only trusted provenance fields. | `RPF12-DOC-002`; **0 debugger-new** |

## Reproduction evidence

### 1. Shared `capGroup` overload

- **Identity creation:** `packages/core/src/calculator/reward.ts:88-90`
- **Daily and monthly consumers:**
  `packages/core/src/calculator/reward.ts:315-387,789-968`
- **Validator gap:** `packages/rules/src/catalog-validation.ts:201-455`

Two percentage rules used the same `capGroup` but different monthly caps
(100 and 1,000 Won). Two separately scoped fixed-per-day rules used the same
group and coherent 1,000 Won caps. Both cards produced zero semantic-validation
issues. The calculator returned:

```text
percentage, 100-Won-cap transaction first:    200
percentage, 1,000-Won-cap transaction first:  100
fixed-per-day independent expected total:      300
fixed-per-day actual total:                    100
```

The same key therefore acts as the shared monthly ledger, a rule identity, and
the daily-occurrence identity. This fully confirms `C12-CR-001`; it is not a
second debugger finding.

### 2. Standalone report period wording

- **Type contract:** `packages/core/src/models/result.ts:25-35`
- **Incorrect sink:** `packages/viz/src/report/generator.ts:412-427`

Generating a report with
`{ capType: "per_transaction", capAmount: 50, actualReward: 100,
appliedReward: 50 }` produced:

```text
[Probe Card] dining: 월 한도 50원 도달 — 50원 혜택 손실
```

The loss amount is right and the period is wrong. `C12-CR-002` owns the
defect.

### 3. Whitespace-first scraper selection

- **Selection/fallback:** `tools/scraper/src/fetcher.ts:321-365`
- **Input admission and request:** `tools/scraper/src/extractor.ts:38-49,145-171`

For a document containing an empty-whitespace `<main>` followed by a populated
`#content`, `cleanHTML()` returned a zero-length string and did not retain
“Real Card Benefits.” `buildCardExtractionRequest()` then accepted the value
and placed `""` between the untrusted-source delimiters. The raw whitespace is
truthy when the selector loop breaks, but becomes empty only after the later
normalization. This confirms `C12-CR-003`.

### 4. Statement-sized CLI copies

- **Wrapper capture and replay:** `tools/cli/src/parse-statement.ts:43-83`
- **Parser complete-read cache:** `packages/parser/src/statement.ts:48-81`

A 16 MiB injected source buffer was captured through the local-first seam. Two
parser reads and one prefix read were all different objects with different
backing `ArrayBuffer` identities from the source and from one another:

```text
fullA === source                         false
fullA === fullB                          false
fullA.buffer === source.buffer           false
fullA.buffer === fullB.buffer            false
prefix.buffer === fullA.buffer           false
```

This independently establishes the copy mechanism behind
`RPF12-PERF-001`; the performance report owns its measured memory impact.

### 5. Muted hostname contrast

- **Light tokens:** `apps/web/src/app.css:5-24`
- **Shinhan color:** `apps/web/src/lib/formatters.ts:130-157`
- **Tint and hostname:** `apps/web/src/components/cards/CardDetail.svelte:
  210-214,268-282`

Compositing Shinhan `#0046ff` at `0x22/255` over `#f8fafc` yields approximately
`#d7e2fc`. The `#64748b` muted text contrast against it is **3.665:1**. At the
lighter `0x08/255` stop it is still only **4.317:1**; only the fully transparent
end reaches about **4.548:1**. Normal 14 px hostname text therefore crosses
below the 4.5:1 requirement across the tinted banner. This confirms
`RPF12-D-001`.

### 6. CardGrid search SVG semantics

- **Glyph:** `apps/web/src/components/cards/CardGrid.svelte:295-315`
- **Incomplete regression scope:**
  `apps/web/__tests__/decorative-svg-semantics.test.ts:1-47`

The extracted SVG opening tag has no `aria-hidden`, `focusable="false"`,
`aria-label`, or role, and its block has no `<title>`. The behavior is real.
However, Cycle 9 already reported decorative inline SVGs escaping the hidden
icon contract and prescribed the same semantics and repair. The CardGrid
glyph predates the incomplete Plan 119 implementation. This is a missed site
of that historical root cause, not a genuinely new Cycle 12 bug.

### 7. Root `parse` script

- **Declared script:** `package.json:30`
- **Export-only target:** `packages/parser/src/index.ts:1-49`
- **Real API:** `packages/parser/src/statement.ts:43-52`

Both probes succeeded without parsing:

```text
$ bun run parse -- /definitely/not/a/statement.csv
$ bun run packages/parser/src/index.ts /definitely/not/a/statement.csv
parse_exit_status=0

$ bun run parse -- --help
$ bun run packages/parser/src/index.ts --help
parse_help_exit_status=0
```

The second `$ bun run ...` line in each pair is Bun's command echo. There was
no program output or error. This confirms `RPF12-DOC-001`.

### 8. False URL-boundary wording

- **Prompt:** `tools/scraper/src/prompts/system.ts:23-30`
- **Enforcing test:** `tools/scraper/__tests__/schema-contract.test.ts:96-106`
- **Actual boundary:** `tools/scraper/src/extractor.ts:93-121`
- **Accurate request wording:** `tools/scraper/src/extractor.ts:145-159`

The live prompt contains both the assertion that
`url, issuer, source, lastUpdated` are boundary-recorded and the phrase
“official product URL.” A synthetic tool response attempted to provide
`https://attacker.example/probe`; `parseCardExtractionResponse()` returned no
`card.url` and stamped exactly:

```json
{
  "issuer": "shinhan",
  "source": "llm-scrape",
  "lastUpdated": "2026-07-23"
}
```

The runtime remains fail-closed. The false operational description and
test-name/assertion mismatch are exactly `RPF12-DOC-002`.

## Later same-cycle reconciliation

Two sibling findings appeared after the original eight-candidate brief and
were checked before close:

- **`C12-CT-001` — browser cap explanations are discarded:** confirmed under
  the critic report. `capsHit` survives the store, worker decoder, coherence
  validation, and persistence, but a complete `apps/web/src` search finds no
  presentation consumer: its only uses are in
  `analysis-result.ts:298-299`, `optimizer/worker-protocol.ts:143-144`, and
  `persistence.ts:311-312`. Neither `/results` nor `ReportContent` renders it.
  This remains one critic-owned Medium finding, not a debugger finding.
- **`RPF12-TE-001` — no pre-merge repository verification:** confirmed under
  the test-engineer report. `.github/workflows/deploy.yml:3-6` is the only
  workflow and has only `push` to `main` plus `workflow_dispatch`; the strong
  verification steps at lines 41-45 therefore create no pull-request check.
  The workflow-contract test does not inspect the trigger map. This remains
  one test-engineer-owned Medium finding.

The architect and security zero-finding conclusions are not contradicted by a
new architecture- or security-specific failure. All other same-cycle findings
remain with their originating reports.

## Historical reconciliation and missed-issue sweep

- Cycle 11's amount-sign, matcher-boundary, plural cap-telemetry, and neutral
  source-link repairs were traced through their producers, validators, worker
  and persistence boundaries, and output consumers. No separate regression
  survived the sweep.
- Previously fixed parser duplication, schema/type drift, worker-reader
  duplication, persistence/replacement state machines, optimizer/matcher
  redesign items, and resource/virtualization debt were not relabeled.
- Shared-cap semantics are a current custom-authoring/future-catalog failure,
  while the authored 683-card catalog currently contains no shared cap group;
  that reachability distinction does not create a second finding.
- The rejected leading-NUL/prefixed-XLSX hypothesis remains rejected. No new
  evidence changes the byte-zero ZIP signature precondition, so it was not
  revived.

The full non-browser unit gate passed **3,060 tests, 0 failures**:

```text
parser       1,539
rules          134
core           268
viz             23
web            833
scraper         96
CLI             96
scripts         71
total        3,060
```

The closing state/race/error sweep revisited malformed and empty parser input,
refund and foreign-currency containment, category-cache and no-hit paths,
rule/occurrence/monthly/global cap transitions, optimizer aggregation,
analysis coherence, worker decode/settlement, persistence migration,
upload/replacement ordering, concurrent report creation and symlink defenses,
CLI local/remote consent sequencing, scraper selector/fetch timeout/
quarantine boundaries, generated-catalog identity, report sinks, and current
workflow gates. Apart from issues already owned above, candidates were fixed,
deferred, historical, intentionally specified, immaterial, or not
reproducible.

The six protected Cycle 42 artifacts retained their pre-review SHA-256
digests. No browser, E2E suite, server, external lookup, source/test/plan/
generated edit, staging, commit, push, or deployment was performed.

**Final count: 0 genuinely new debugger findings; all eight requested
candidates independently confirmed, with the unnamed SVG classified as a
historical duplicate rather than Cycle 12 novelty.**
