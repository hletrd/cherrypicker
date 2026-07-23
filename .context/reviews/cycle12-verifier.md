# Review-plan-fix Cycle 12 — verifier

- Date: 2026-07-24
- Verified revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Raw candidates adjudicated: **10**
- Unique retained findings: **9 — 6 Medium, 3 Low**
- Rejected candidates: **1 historical duplicate**
- Scope: verification and this report only; no implementation, source/test/config
  or generated-artifact change, staging, commit, push, server, browser/E2E run,
  deployment, or external-system mutation

## Inventory and adjudication method

The verifier locked the review to the exact revision above and reconciled the
complete **2,291-path tracked repository**: **1,129** tracked `.context` paths
and **1,162** active product, data, test, documentation, workflow,
configuration, and vendor-integrity paths. All nine Cycle 12 sibling reports
were read and reconciled: architect, code reviewer, critic, debugger, designer,
document specialist, performance reviewer, security reviewer, and test
engineer. The architect, debugger, and security lanes added no candidates of
their own.

Each raw candidate was checked at the current producer, contract boundary,
state transition, and user-visible sink. Bounded executable probes were used
where they materially distinguished behavior; source and history searches
covered all current and archived plans/reviews. The verifier preserves the
highest supported severity and confidence, assigns no second ID to the same
root defect, and does not count a historical residual as new.

## Validation matrix

| Raw candidate | Specialist rating | Verifier disposition | Final rating | Decisive current-HEAD evidence |
| --- | --- | --- | --- | --- |
| `C12-CR-001` — shared `capGroup` identities and coherence | Medium / High | **Retain** | Medium / High | One key is reused for monthly state and fixed-per-day state (`packages/core/src/calculator/reward.ts:88-90,345-387,633-639,789-805,837-860,897-968`), while validation checks rules individually and never enforces shared-group cap or reward coherence (`packages/rules/src/catalog-validation.ts:201-404,425-455`). |
| `C12-CR-002` — report cap period | Low / High | **Retain** | Low / High | Every cap event is rendered as a monthly cap (`packages/viz/src/report/generator.ts:412-427`) even though the model and calculator emit `per_transaction` events (`packages/core/src/models/result.ts:25-35`; `packages/core/src/calculator/reward.ts:884-895`). |
| `C12-CR-003` — scraper whitespace fallback | Low / High | **Retain** | Low / High | The selector loop accepts the first raw truthy fragment before normalization (`tools/scraper/src/fetcher.ts:321-365`), and the CLI forwards the empty cleaned result (`tools/scraper/src/cli.ts:149-169`) to an extractor that has only a maximum-size input guard (`tools/scraper/src/extractor.ts:38-49`). |
| `RPF12-PERF-001` — CLI statement copy amplification | Medium / High | **Retain** | Medium / High | The local-first boundary copies the full source buffer into a new `Uint8Array`, then copies it again for the parser (`tools/cli/src/parse-statement.ts:43-69`); the parser retains/decodes that input (`packages/parser/src/statement.ts:48-89`). |
| `RPF12-D-001` — source-hostname contrast | Medium / High | **Retain** | Medium / High | The 14 px muted hostname is drawn over an issuer-tinted header (`apps/web/src/components/cards/CardDetail.svelte:207-214,268-286`) using `#64748b` (`apps/web/src/app.css:20-24`), which reaches only about 3.67:1 on the strongest Shinhan tint. |
| `RPF12-D-002` — unnamed CardGrid SVG | Low / High | **Reject: duplicate** | Counted under historical `C9-D-01` / Plan 119 | The current glyph is indeed decorative and unnamed (`apps/web/src/components/cards/CardGrid.svelte:296-310`), but it predates Cycle 9 and has the same root cause, assistive-technology failure, and exact repair already recorded at `.context/reviews/2026-07-24-rpf-cycle9-designer.md:77-104` and `.context/plans/_archive/119-cycle9-decorative-svg-semantics.md:7-25`. |
| `RPF12-DOC-001` — no-op root parse script | Medium / High | **Retain** | Medium / High | The root script executes an export barrel (`package.json:30`; `packages/parser/src/index.ts:1-49`) instead of the real parse API (`packages/parser/src/statement.ts:43-52`) or CLI (`tools/cli/src/index.ts:17-49`). |
| `RPF12-DOC-002` — scraper URL-stamping wording | Low / High | **Retain** | Low / High | The system prompt says the scraper records `url` while also telling the model to leave it blank (`tools/scraper/src/prompts/system.ts:23-30`); the deterministic boundary deletes model URL data and stamps only issuer/date/source (`tools/scraper/src/extractor.ts:93-120`). |
| `C12-CT-001` — browser and in-app report omit cap-hit disclosure | Medium / High | **Retain** | Medium / High | The store preserves full card results (`apps/web/src/lib/store.svelte.ts:291-303`), but `/results` renders only warnings/summary/comparison/map (`apps/web/src/pages/results.astro:76-115`) and `ReportContent` renders totals, assignments, and card breakdowns without reading `capsHit` (`apps/web/src/components/report/ReportContent.svelte:13-24,40-130,198-246`). |
| `RPF12-TE-001` — no pre-merge workflow verification | Medium / High | **Retain** | Medium / High | The sole workflow runs only on `main` push/manual dispatch and executes verification after that event (`.github/workflows/deploy.yml:3-6,14-45`); its parsed contract omits the trigger map and never tests it (`scripts/__tests__/workflow-consistency.test.ts:23-39,56-202`). |

## Candidate validation

### `C12-CR-001` — retained

`buildRuleKey` returns `capGroup` first. That value keys both
`ruleMonthUsed` and `dayRewardTracker`, so it is simultaneously treated as a
shared cap bucket and as a reward-execution identity. A schema-valid fixture
with two percentage rules sharing one group but declaring different monthly
caps was accepted by `validateCardRuleSet`; reversing transaction order changed
the total from 200 to 100 Won. A second accepted fixture with coherent caps but
two independent `fixed_per_day` rewards returned 100 or 200 Won instead of the
expected combined 300, depending on order:

```json
{
  "validator": "accepted both",
  "inconsistentCaps": {
    "diningThenGrocery": 200,
    "groceryThenDining": 100
  },
  "fixedPerDay": {
    "diningThenGrocery": 100,
    "groceryThenDining": 200,
    "independentExpected": 300
  }
}
```

This violates the established rule contract that shared caps use `capGroup`,
independent caps use distinct groups, and source order must not determine
business behavior (`.context/plans/_archive/68-cycle1-domain-state-contract.md:341-346`).
Cycle 11/Plan 127 repaired plural telemetry identity after calculation; this
finding concerns calculation-state identity and validator coherence, so it is
distinct.

### `C12-CR-002` — retained

A generated standalone report containing a real `per_transaction` `CapInfo`
rendered:

```text
[카드] dining: 월 한도 100원 도달 — 50원 혜택 손실
```

The amount and loss are correct, but “monthly cap” is false for a per-purchase
event and can imply that later purchases earn nothing. This is a wording defect
in a sink that does render the event; it is separate from `C12-CT-001`, whose
browser sinks render no cap event at all.

### `C12-CR-003` — retained

The bounded cleaner probe:

```ts
cleanHTML(
  '<main>\n </main><section id="content"><h1>카드 혜택</h1>' +
  '<p>대중교통 10% 할인</p></section>',
)
```

returned `""`. The existing whitespace-only `<main>` is truthy when selected,
so the loop stops before the populated `#content`; only afterward does
normalization erase the whitespace. Quarantine limits publication harm, but it
does not restore the discarded source or avoid the wasted extraction request.

### `RPF12-PERF-001` — retained

An 8 MiB injected local-first parse probe established that the wrapper's source
buffer, parser bytes, and parser-prefix bytes used different backing buffers:

```json
{
  "bytes": 8388608,
  "sourceToParserSameObject": false,
  "sourceToParserSameArrayBuffer": false,
  "parserBytes": 8388608,
  "prefixBytes": 4096,
  "prefixSharesParserBuffer": false
}
```

All three user-facing statement commands use this wrapper
(`tools/cli/src/commands/analyze.ts:28-37`,
`tools/cli/src/commands/optimize.ts:45-54`,
`tools/cli/src/commands/report.ts:49-59`), and the CLI validation boundary does
not impose a file-size limit (`tools/cli/src/validation.ts:18-66`). The
consent-bound local-byte design remains valid; it does not require two
additional statement-sized copies. Earlier performance work concerned repeated
disk reads, not the current in-memory copy chain.

### `RPF12-D-001` — retained

Independent sRGB contrast calculations gave:

```text
#64748b on #d7e2fc (strongest Shinhan tint): 3.67:1
#64748b on sampled nearby pixels:            3.89:1–3.95:1
#64748b on the plain body background:        4.55:1
```

The hostname is normal 14 px text, so the tinted-header values fail the 4.5:1
normal-text threshold. Git history places this hostname treatment in the
post-Cycle-11 source-link work; no earlier review owns this contrast failure.

### `RPF12-D-002` — rejected as a historical duplicate

The current CardGrid magnifier SVG lacks both an accessible name and the
decorative `aria-hidden="true"` / `focusable="false"` contract. The behavior is
real. Novelty is not.

`git blame` attributes the glyph to commit `2f67466`, and an ancestry check
confirmed that commit precedes the Cycle 9 reviewed snapshot. Cycle 9's
`C9-D-01` already identified decorative inline SVGs bypassing the shared icon
contract, appearing as unnamed images, and requiring the same two attributes.
Plan 119 applied that repair to its enumerated FileDropzone and CardDetail
sites but missed this already-existing CardGrid site. That is an incomplete
sweep of the same root repair, not a new Cycle 12 defect. It should be reopened
or merged under historical `C9-D-01` / `C9-011`; it receives no new ID and
adds zero to the unique count.

### `RPF12-DOC-001` — retained

`bun run parse -- ./definitely-not-a-statement.csv` exited zero without reading
the nonexistent file or producing parser output. Its only text was Bun's
command echo:

```text
$ bun run packages/parser/src/index.ts ./definitely-not-a-statement.csv
```

The target is an export-only module, so the documented root command silently
does no work for any argument. Full-history searches found no earlier finding
for this exact script contract.

### `RPF12-DOC-002` — retained

The prompt's operational claim is internally contradictory and disagrees with
the deterministic trust boundary. A response containing an attacker-controlled
URL was parsed with the URL removed and only trusted metadata stamped:

```json
{
  "promptClaimsUrlStamped": true,
  "userMessageListsOnlyMetadata": true,
  "result": {
    "issuer": "shinhan",
    "source": "llm-scrape",
    "lastUpdated": "2026-07-23"
  }
}
```

The schema-contract test preserves the same false prompt sentence
(`tools/scraper/__tests__/schema-contract.test.ts:96-106`), while the runtime
user message accurately lists only issuer, source, and retrieval time
(`tools/scraper/src/extractor.ts:145-159`). Plan 122 deliberately established
URL deletion; Plan 128 later repaired public source-link semantics. Neither
reported this remaining false system-prompt claim.

### `C12-CT-001` — retained

`CardRewardResult.capsHit` survives the optimizer, worker, persistence, and
store boundaries, but a complete scan of all 20 web component/page files found
no read of `capsHit`, `capReached`, “혜택 손실”, or “한도 도달” in any browser
sink. The terminal and standalone report do disclose the events
(`packages/viz/src/terminal/comparison.ts:77-89`,
`packages/viz/src/terminal/summary.ts:86-97`,
`packages/viz/src/report/generator.ts:346-383,412-427`).

The critic's real-card optimizer probe returned a 2,000 Won uncapped dining
reward clipped to 1,000 Won by a supported per-transaction cap. Browser results
and the printable in-app report show only the 1,000 Won outcome. The numerical
recommendation is correct, which keeps severity at Medium, but the missing
explanation prevents a user from telling whether the lower reward came from a
weak rate, a per-purchase clip, or exhausted monthly capacity. Plan 127 ensured
the telemetry survives web boundaries; it did not add a browser presentation
sink, so this is new and distinct.

### `RPF12-TE-001` — retained

Parsing the sole tracked workflow produced:

```json
{
  "events": ["push", "workflow_dispatch"],
  "pullRequest": null,
  "jobs": ["build", "deploy"],
  "contractMentionsOn": false
}
```

The repository therefore creates no automatic verification or E2E status for a
pull request. A failure after the `main` push can prevent Pages deployment, but
the default branch is already broken. The current workflow-contract suite
strongly verifies permissions, action pins, toolchain versions, command
contents, ordering, and E2E configuration while being structurally unable to
notice the absent trigger.

This is not deferred `D-05`: that record's exit criterion was to add
test/lint/typecheck content to the deploy workflow
(`.context/plans/00-deferred-items.md:41-47`), which the current `verify` step
satisfies. Full-history searches found no prior pre-merge/PR-trigger owner.

## Historical reconciliation and exclusion ledger

- `RPF12-D-002` is the only rejected raw candidate. Its current site is real,
  but it is a residual of `C9-D-01` / Plan 119 and receives no Cycle 12 count.
- `C12-CR-001` is not Cycle 11's rejected-web-decoder or plural-cap telemetry
  defect; it changes calculation outcomes before telemetry is produced.
- `C12-CR-002` and `C12-CT-001` are not duplicates: one misstates the period in
  a working standalone sink, while the other omits every event from two browser
  sinks.
- `RPF12-DOC-002` is distinct from Plans 122 and 128 because those establish
  URL trust/public rendering; the false extraction-system instruction remains.
- `RPF12-TE-001` is distinct from the old missing-gate-content item because the
  commands now exist but run only after merge.
- Full current/archived plan and review searches did not reveal an earlier
  owner for the other retained candidates.
- The rejected leading-NUL/prefixed-XLSX hypothesis remains rejected. No new
  evidence changes the byte-zero `PK` admission precondition in
  `packages/parser/src/shared/xlsx-archive.ts:113-132`; it is not revived.

## Verification and final missed-issue sweep

The verifier ran bounded executable probes for shared-cap order dependence and
fixed-per-day collapse, report wording, scraper selector fallback, CLI byte
identity, the root parse command, scraper URL sanitization, color contrast, and
workflow trigger parsing. Static complete-sink searches validated the browser
cap-disclosure omission. Git blame, ancestry, and full `.context` searches
adjudicated novelty. No server, browser, E2E suite, deployment, or broad test
suite was run in this verifier lane.

The closing sweep revisited calculator state identities, optimizer/result
transport, every browser and report cap sink, parser admission and CLI consent
boundaries, scraper fetch/extraction/trust/quarantine paths, accessibility and
color contracts, package scripts, the sole workflow and its contract tests,
all sibling findings, completed/archived plans, deferred items, and rejected
hypotheses. No additional evidence-backed, genuinely new issue survived
duplication and contract checks.

The six protected Cycle 42 artifacts remained byte-identical and out of scope.
This report is the only repository path written by the verifier.

**Final unique count: 9 retained — 6 Medium, 3 Low. Rejected: 1 historical
duplicate.**

## Prompt 3 implementation verification addendum

The review disposition above records the baseline review boundary. Prompt 3
subsequently closed every retained finding:

| Finding | Plan | Remediation commit | Closure check |
|---|---:|---|---|
| C12-001 | 129 | `2812cea6bcbf568d5caf3b89bc00a71d01171095` | Separate rule/cap identities, deterministic reversal controls, and incoherent-group rejection pass. |
| C12-002 | 130 | `6ab9416a539b50fdc31079440fa53988ec0c4642` | All three cap periods render truthfully. |
| C12-003 | 131 | `3a22cbef8267c481dda8e5a6a392935df292c5f1` | Empty candidates fall through; empty extraction fails locally. |
| C12-004 | 132 | `8c0e119ffef3b8f9832c0a6c77139ca3d9cf3e40` | Local-only parsing skips the snapshot; remote retry retains exact-byte identity. |
| C12-005 | 133 | `ca4a9cd041bb93b8280f911a2d5476770624601a` | The complete 24-issuer light/dark contrast matrix passes AA. |
| C12-006 | 134 | `087f2e5dfc209ac2407dec0c1d77a8b988569f51` | The root alias executes real CLI parsing and invalid-input diagnostics. |
| C12-007 | 135 | `3a22cbef8267c481dda8e5a6a392935df292c5f1` | Trust wording matches URL deletion and deterministic metadata stamping. |
| C12-008 | 136 | `c1126fd9c89efae2049cc4e2b56be025a56a4774` | All browser result surfaces preserve ordered/repeated events and show applied/lost reward. |
| C12-009 | 137 | `a8a8276da2b0b79484fc1a5e3289fa295b2b690e` | Static workflow policy proves read-only PR verification and trusted-only publication. |

The full source-head matrix passed: lint, typecheck, build, every workspace
test, 1,641 Bun-native tests, 2,996 Vitest tests, and 96 repository-owned E2E
tests. E2E pre/post cleanup assertions passed with TCP 4173 available. No
workflow was dispatched and no deployment occurred.
