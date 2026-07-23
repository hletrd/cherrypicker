# Review-plan-fix Cycle 12 — document specialist

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Final count: **2 genuinely new findings — 1 Medium, 1 Low**
- Scope: review and this report only; no source, test, plan, generated-data,
  staging, commit, push, deployment, server, browser, E2E, or external-system
  change

## Inventory and review method

I inventoried all **2,291 tracked paths**: **1,129** historical/current
`.context` paths and **1,162** active product, data, test, documentation,
workflow, configuration, and vendor-integrity paths. The active Markdown
inventory contains 29 files. Twenty-eight are current hand-written
documentation (the root README, both `.claude` guides, 24 issuer READMEs, and
the vendor policy); `.omc/plans/cycle14-fixes.md` is historical provenance,
not current product guidance. The license was reviewed separately.

The pass treated package scripts and executable help as developer-facing
contracts, and treated public web/terminal/report copy, schemas, comments and
JSDoc, scraper prompts, generated-document templates, and publication tests
as documentation where they describe behavior. I traced those claims through
the workspace manifests and lockfile, workflow/toolchain configuration,
parser/CLI/scraper entry points, canonical rules schemas, publication and
README generators, generated catalog projections, web loaders/components,
and representative authored records.

For duplicate control, I indexed every `.context` finding and plan by ID,
path, and claim, read every implicated current/archived plan and report, and
reconciled all same-cycle reports present before this report was written.
The two findings below have no prior owner. They do not duplicate
`RPF12-PERF-001`, the three Cycle 12 code-review findings, the two Cycle 12
designer findings, or the architect and security reviews' zero-finding
results.

## RPF12-DOC-001 — the root `parse` command is a successful no-op

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by static entry-point trace and read-only command
  invocation
- **Declared command:** `package.json:30`
- **Executed module:** `packages/parser/src/index.ts:1-49`
- **Real parser API:** `packages/parser/src/statement.ts:43-52`
- **Working CLI route:** `package.json:32`;
  `tools/cli/src/index.ts:1-51`

The root manifest advertises:

```json
"parse": "bun run packages/parser/src/index.ts"
```

That target is the parser package's export barrel. It contains only type and
value re-exports; it has no argument parser, `import.meta.main` branch,
`parseStatement(...)` call, output, or error path. The real parsing operation
is the exported `parseStatement(filePath, options)` API, while the functional
command-line path is the `analyze` subcommand.

A read-only probe reproduced the contract failure:

```text
$ bun run parse --help
$ bun run packages/parser/src/index.ts --help
```

The second line is Bun's command echo. The process then exited successfully
without help or any parser output. Supplying a statement path reaches the
same export-only module, so the path is ignored and the process still reports
success.

**Concrete scenario:** a contributor or automation job discovers the root
script and runs `bun run parse -- ./statement.csv`, expecting the declared
operation to parse or validate the statement. The command consumes no input,
emits no result or diagnostic, and exits zero. A pipeline can therefore mark
an unperformed parse as successful.

**Root fix:** either remove the misleading script if parsing is intentionally
API-only, or point it at a dedicated executable that consumes the statement
path, calls `parseStatement`, prints a documented result, and returns nonzero
for invalid invocation or parse failure. Add a command-contract check that
passes a real argument and proves the process cannot silently succeed without
consuming it.

## RPF12-DOC-002 — the scraper prompt and its test falsely say the boundary records `url`

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed by prompt-to-boundary trace; runtime quarantine remains
  fail-closed
- **False prompt contract:** `tools/scraper/src/prompts/system.ts:23-30`
- **Test that locks in the false claim:**
  `tools/scraper/__tests__/schema-contract.test.ts:96-106`
- **Actual deterministic boundary:** `tools/scraper/src/extractor.ts:94-116`
- **Accurate user-message contract:** `tools/scraper/src/extractor.ts:145-159`
- **Current neutral source-URL contract:**
  `packages/rules/src/schema.ts:262-285`;
  `apps/web/src/lib/external-url.ts:8-21`

The system prompt says that `url`, `issuer`, `source`, and `lastUpdated` are
recorded by the scraper at its trust boundary, then immediately says the URL
is left blank until source review. The schema-contract test names the field an
“official URL” and explicitly requires the first, inaccurate sentence to
remain present.

The implementation does something safer and materially different. Its
deterministic boundary clones the model card, deletes `url`, and stamps only
`issuer`, `lastUpdated`, and `source: 'llm-scrape'`. The request's user message
also accurately lists only the card issuer, provenance, and extraction time
as scraper-recorded fields. Current schema and UI-helper terminology treats a
reviewed value as a neutral card source URL, not proof of an issuer-official
destination.

This is not a repeat of Cycle 11's fixed issuer-official UI label.
Plan 128 neutralized the rendered source-link semantics. The surviving defect
is an operational statement about what the deterministic extraction boundary
records, and the test enforces that false statement. It originated in the
same trust repair that deliberately made the boundary delete the field.

**Concrete scenario:** a maintainer uses the prompt and named contract test as
the specification while changing scraper provenance handling. The test tells
them that the boundary is responsible for supplying `url`, so they can
“restore” fetched-page URL stamping or preserve a URL while believing they
are maintaining the tested contract. That would conflict with the deliberate
review-pending omission. Today the tool schema and deletion boundary still
prevent publication, so the current impact is documentation and regression
risk rather than an active link escape.

**Root fix:** state separately that the scraper stamps `issuer`, `source`, and
`lastUpdated`, while `url` remains absent until explicit reviewer authoring.
Rename the test to describe an omitted source URL, replace the inaccurate
prompt-string assertion, and assert the actual boundary behavior: the model
schema omits `url` and deterministic quarantine deletes any attempted value.
Avoid “official URL” terminology unless a distinct issuer-bound field is
introduced.

## Historical reconciliation and excluded candidates

- `RPF12-PERF-001` owns eager CLI statement-buffer copying and is not repeated.
- `C12-CR-002` owns the standalone HTML report's false monthly-cap wording;
  the other same-cycle code and designer findings likewise remain with their
  originating reports.
- The Cycle 12 architect and security reports found no additional issue; no
  architecture or trust-boundary candidate was relabeled here.
- Cycle 10 Plans 122–124 remain closed at their runtime boundaries. The second
  finding above is limited to a never-previously-reported false scraper
  boundary description and its enforcing test.
- Plan 128's neutral user-facing source-link repair is present. No old
  “official card page” UI finding is revived.
- Generated issuer indexes correctly identify catalog-only cards. The
  hand-written representative benefit summaries were therefore not relabeled
  as a new optimizer-eligibility defect already owned by the prior catalog
  documentation work.
- The remaining `scripts/build-json.ts` comment that says “a single organized
  JSON file” is historical residue of the already-owned multi-artifact
  publication finding and is not counted again.
- The rejected prefixed-XLSX hypothesis was not revived.

## Verification and final missed-issue sweep

The following read-only documentation/data/toolchain checks passed at the
reviewed revision:

```text
bun run docs:check
Verified README catalog: 683 cards (551 optimizer-executable) across 24 issuers.

bun scripts/build-json.ts --check
683 card YAML files parsed; generated catalog artifacts current.

bun run toolchain:check
Bun 1.3.12

bun run dependencies:check
Dependency integrity check passed.
```

Rendered `analyze`, `optimize`, and scraper help agreed with their parsers and
defaults. The `parse` probe is documented as finding `RPF12-DOC-001`, not a
passing help check. The final sweep rechecked supported formats, remote-LLM
consent and key names, scraper model/host/output/quarantine guidance,
generated-data ownership, catalog counts and optimizer markers, category and
issuer inventories, framework/toolchain versions, workflow commands, public
source-link copy, report/terminal terminology, schema comments, and every
same-cycle finding available at write time. No third genuinely new
documentation/code mismatch met the evidence threshold.

The six protected Cycle 42 artifacts retained their pre-review SHA-256
digests. No test, server, browser, E2E, external lookup, source/test/plan/
generated edit, staging, commit, push, or deployment was performed.

**Final count: 2 new findings — 1 Medium, 1 Low.**
