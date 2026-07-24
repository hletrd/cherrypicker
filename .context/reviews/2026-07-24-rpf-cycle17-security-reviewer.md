# Review-plan-fix Cycle 17 — security reviewer

- Date: 2026-07-24
- Reviewed revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: OWASP-style injection and unsafe parsing, secrets, authentication and
  authorization applicability, browser/worker and privacy boundaries,
  archive/network/path/filesystem controls, resource exhaustion, dependency
  and workflow supply chain, and cross-file data flow
- Method status: **complete manual whole-tree/history review plus bounded
  read-only validation**
- Disposition: **one genuinely new Medium finding**
- Scope: review and this report only; no source, test, generated artifact,
  plan, dependency, staging, commit, push, deployment, browser, server, or
  external-system mutation

## Finding count

**Final count: 1 new finding — Medium severity, High confidence, confirmed.**

No Critical or High finding survived exact-source validation and historical
deduplication.

## Inventory and coverage

The closing inventory classified all **2,374 tracked paths**: **1,204**
`.context` paths (890 reviews and 314 plans) and **1,170** active product,
data, test, documentation, workflow, configuration, and vendor-integrity
paths. The active inventory includes:

- 172 paths under `apps/`, including every web production component, page,
  parser/optimizer worker, persistence boundary, static script, public runtime
  artifact, and test;
- 881 paths under `packages/`, including all core, parser, rules, and
  visualization source plus all 683 authored card YAML files and generated
  catalogs;
- 63 paths under `tools/`, including all CLI and scraper source, tests, and
  issuer targets;
- all 19 repository scripts, 16 E2E paths, the deployment workflow, manifests,
  lockfile, compiler/build/test configuration, documentation, and the three
  vendored SheetJS integrity paths; and
- 180 unit/integration/E2E test-like paths used to understand the intended
  security contracts and existing regression ownership.

High-volume authored/generated data was assessed at its schema, semantic
validation, source-identity, publication, runtime-reader, and final rendering
boundaries rather than treating repeated generated records as independent
code. A Git archive readability/hash pass covered every tracked blob at the
reviewed revision (`94c3ac9054a1c6867c07643e988f7028b03ae7df2014b0e358b2f76fddf3caf6`).
The tracked tree contains no symbolic-link or submodule boundary.

The deployed application is static and client-only. It has no application
account, authentication cookie, server session, database, privileged mutable
API, or role surface, so application login authentication and server-side
authorization are not applicable. The material authorization boundary is the
explicit CLI consent decision before bounded PDF text may be sent to the
remote LLM provider.

## Retained finding

### C17-SEC-001 — generated category labels are emitted as TypeScript source without structured serialization

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed — manual cross-file trace plus bounded in-memory
  validation**
- Classification: **CWE-94 / OWASP A03 Injection and A08 Software and Data
  Integrity**
- Schema boundary: `packages/rules/src/schema.ts:303-320`
- Source generator: `scripts/build-json.ts:451-461`
- Generated module: `apps/web/src/lib/category-labels-fallback.ts:1-5`
- Browser export/import path:
  `apps/web/src/lib/category-labels.ts:21-23`,
  `apps/web/src/components/cards/CardDetail.svelte:6-8`,
  `apps/web/src/components/cards/CardPage.svelte:3-4`, and
  `apps/web/src/pages/cards/index.astro:3-8`
- Verification/publication path: `package.json:19-20,29` and
  `.github/workflows/deploy.yml:42-46`

The canonical category schema accepts unrestricted strings for category IDs
and labels. The fallback generator then places those values directly between
hand-written single quotes while constructing a TypeScript module. JSON
catalog publication correctly uses `JSON.stringify`, but this one generated
source projection does not use an equivalent serializer.

The complete trust path is:

`categories.yaml` → permissive category schema → raw source interpolation →
checked-in fallback TypeScript → Svelte card-page bundle → first-party module
evaluation.

An ordinary taxonomy edit containing source-language-significant punctuation
can therefore produce malformed generated TypeScript and fail the build.
More importantly, a schema-valid authored value can alter the syntax and
evaluation behavior of a module that the browser treats as trusted
first-party code. The matching generated artifact can still satisfy
`data:check`, because that check verifies textual parity with the same unsafe
generator. The observable impact ranges from publication failure to
unintended script behavior in the card-page origin, where the application UI
and same-origin browser data are available.

A bounded in-memory validation confirmed that the production category schema
accepts a representative metacharacter-bearing label and that the current
template can produce syntactically valid output with changed evaluation
behavior. No repository file was changed, and the validation input and
executable form are intentionally omitted from this defensive report. The
currently committed taxonomy contains benign values; this is a latent
authoring/publication boundary, not evidence that the present catalog is
malicious.

**Remediation**

Build a normal array of `[id, label]` tuples as data, serialize the complete
array with `JSON.stringify`, and embed only that serializer output in the
generated module (for example, as the argument to `new Map`). Do not assemble
individual JavaScript string literals with interpolation. Schema restrictions
on identifier format and label length are useful defense in depth but are not
a substitute for structured serialization.

Add a generator regression test containing ordinary quotes, backslashes,
newlines, Unicode line separators, and other source-significant characters.
The test should prove that the generated module compiles, preserves each
label exactly, and introduces no evaluation beyond construction of the
expected map. Run the same fixture through `data:build`/`data:check` parity.

## Current repair-delta review

The only product-code delta from the Cycle 16 reviewed baseline
`4b1f368d6b8b92cf009ba18d93639f841a8b5d06` is the worksheet-metadata repair
and its browser/server adapters and tests. It closes rather than expands the
previous resource-exhaustion boundary:

- workbook and worksheet metadata is validated immediately after SheetJS
  decoding and before `sheet_to_json` or merge indexing;
- sheet count, row/column endpoints, logical cells, merge count, per-merge
  coverage, per-sheet totals, and workbook totals use safe-integer arithmetic
  and explicit caps;
- browser and server XLSX/HTML adapters translate the typed rejection into one
  stable diagnostic; and
- merge lookup now stores bounded row intervals instead of one entry per
  covered cell.

The final review of duplicate sheet names, absent sheets, malformed `!ref`,
non-array/invalid merges, cumulative arithmetic, direct exported-helper use,
HTML-as-XLS routing, archive preflight ordering, browser exports, and
server/browser parity found no bypass or new security regression in that
repair.

## Whole-tree trust-boundary result

- Browser upload admission remains capped at 10 MiB per file, 50 MiB per
  batch, and 50 files. XLSX central-directory/local-header metadata is checked
  before inflation for entry count, compressed and expanded bytes, ratios,
  methods, encryption, ZIP64/multi-disk markers, range agreement, and totals.
- Parser diagnostics are bounded, parser workers are isolated and terminated,
  JSON persistence rejects prototype-related keys before exhaustive shape and
  financial-coherence validation, and the only production raw-HTML site
  selects repository-owned static icon content.
- Standalone-report data is HTML-escaped under a script-free CSP. Terminal
  output removes escape, control, and bidirectional-control characters.
  Report and scraper output writers retain and revalidate trusted directory
  capabilities, reject links/non-regular destinations, and use private,
  exclusive, no-follow temporary files and atomic commits.
- External links require unchanged absolute HTTP(S) URLs without credentials,
  padding, or controls. Scraper requests enforce exact host allowlists,
  public-only DNS answers, pinned lookup, connected-address verification,
  redirect revalidation, bounded HTML media/encoding/body/deadline policy, and
  model-output quarantine before canonical validation.
- Remote PDF fallback remains disabled by default, local-first, explicitly
  consented, byte-identity-bound, input/output-bounded, and structurally
  validated. Runtime provider secrets remain environment-only and are not
  logged or published.
- The deployment workflow has empty top-level permissions, a read-only build
  job, disabled checkout credential persistence, a frozen lock, full-SHA
  action pins, and separate Pages/OIDC authority that pull requests cannot
  enter.

## Historical reconciliation

All 1,204 tracked `.context` review and plan paths were inventoried. The
complete Cycle 16 materials were read as the immediate baseline, and exact
line references plus code-generation, generated-source, category-label,
escaping, quoting, injection, and supply-chain terms were searched across the
full tracked history.

No prior review, plan, deferred item, or aggregate owns C17-SEC-001:

- Cycle 7/8 material requested generated fallback labels and discussed drift,
  test ownership, and whether generation belonged in `build-json.ts`; it did
  not identify source-literal encoding or a data-to-code boundary.
- Cycle 6 found incorrect regeneration instructions in the generator and
  generated header; that documentation defect is distinct.
- Cycle 13-15 security reports described generated-data identity and reported
  no new issue, but did not analyze unrestricted category strings entering
  executable TypeScript. Their general coverage statements do not own this
  concrete root cause.
- Cycle 16 exclusively retained the decoded worksheet-metadata resource
  boundary now fixed at the reviewed revision.

Known plaintext `sessionStorage`, static-host CSP/header limitations, regex
HTML normalization, PDF prompt/input redesign, whole-file local CLI parsing,
and earlier parser-duplication/resource candidates remain historical or
deferred items and are not relabeled as Cycle 17 findings. The generated-label
finding is also not a duplicate of ordinary display escaping: the unsafe
transition occurs while producing source code, before Svelte text/attribute
escaping can apply.

## Read-only checks and final missed-issue sweep

- No full repository gate was run during this role review.
- `git diff --check 4b1f368..HEAD` passed.
- Every workflow action reference is pinned to exactly 40 lowercase
  hexadecimal characters.
- A tracked credential-shape scan found matches only in four explicit
  synthetic negative-test files under `tools/scraper/__tests__/`; no private
  key marker or production credential was found.
- Candidate-specific searches over all tracked `.context` files returned no
  prior source-code-injection or generated-label-escaping owner.
- The six protected untracked Cycle 42 artifacts were not opened, modified,
  staged, or committed.

The mandatory closing sweep revisited every current environment read, network
call, parser/archive boundary, dynamic/raw rendering sink, browser-storage
path, worker protocol, subprocess, filesystem mutation, code/data generation
boundary, dependency origin, workflow permission/artifact gate, secret/log
path, and current repair file. No second genuinely new security root survived
exact-source validation and historical deduplication.

Final count: **one new Medium finding, High confidence, confirmed.**
