# Review-plan-fix Cycle 14 — security reviewer

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: OWASP Top 10, secrets, unsafe parsing and data flow, injection/XSS,
  authentication/authorization, browser and worker trust boundaries, privacy,
  SSRF/path/TOCTOU risks, dependencies, CI/workflows, and cross-file
  interactions
- Method status: **complete manual whole-tree/history review plus read-only
  targeted validation**
- Disposition: **pass — no genuinely new current-HEAD security finding**
- Scope: review and this report only; no source, test, generated artifact,
  plan, dependency, staging, commit, push, deployment, server, browser, or
  external-system mutation

## Finding count and required fields

**Final count: 0 new findings.**

There is no finding to which an exact file/line, severity, confidence,
confirmed/likely/manual status, exploit or failure scenario, evidence, or fix
can truthfully be assigned. No Critical, High, Medium, or Low candidate met
both the reproducibility threshold on the exact reviewed revision and the
requirement that it be genuinely new.

## Inventory and coverage

The closing inventory classified and read all **2,337 tracked paths**:
**1,169** `.context` paths (858 reviews and 311 plans) and **1,168** active
product, data, test, documentation, workflow, configuration, and
vendor-integrity paths. Every tracked path was also included in a full-tree
content-hash/readability pass. The active inventory includes:

- 80 web production source paths and 32 public artifacts;
- 26 core, 35 parser, 14 rules, and 9 visualization production source paths;
- all 683 authored card YAML files and their generated catalogs;
- 16 CLI production paths, 12 scraper production paths, and all 10 scraper
  issuer targets;
- 19 repository scripts and 178 unit/integration/E2E test-like paths; and
- the remaining manifests, lockfile, workflow, compiler/build/test
  configuration, documentation, license, and vendored SheetJS archive and
  checksums.

The semantic trace covered browser file admission, format sniffing and every
parser family, XLSX archive preflight, parser and optimizer workers,
persistence deserialization, Astro/Svelte sinks, local and public catalog
loads, external links, CLI argument/path handling, local-first PDF parsing,
remote-LLM consent and byte identity, terminal and standalone-report output,
scraper URL/DNS/redirect/body policy, LLM authority quarantine, filesystem
publication, subprocess arguments, environment reads, dependency provenance,
and CI publication authority.

The deployed application is static and client-only. It has no application
account, authentication cookie, server session, database, privileged mutable
API, or role surface. Application login authentication and server-side
authorization are therefore not applicable. The material authorization
decision is the explicit CLI consent boundary before locally extracted PDF
text may be sent to Anthropic.

## Current repair-delta result

The independent security review of all active-code changes from the Cycle 13
review baseline `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9` to the reviewed
revision found no new weakness.

- The prepared-card optimization path validates reward-tier and shared-cap
  structure once, stores only the original rule reference plus two booleans in
  a frozen invocation-local proof, and checks a module-private symbol before
  entering the unchecked kernel
  (`packages/core/src/calculator/reward.ts:128-188,1117-1171`). The proof
  constructors are absent from the public package barrel
  (`packages/core/src/index.ts:53-68`), while arbitrary public callers still
  pass the full structural validation. The synchronous optimizer creates the
  proofs from its own invocation inputs and exposes no callback that could
  mutate them mid-run.
- New cap-loss telemetry remains non-executable data. Worker decoding rejects
  malformed identities, unsafe arithmetic, duplicate causes and transactions,
  and inconsistent totals
  (`apps/web/src/lib/optimizer/worker-protocol.ts:180-341`). Persistence first
  rejects prototype-related property names at every JSON depth and requires
  plain objects (`apps/web/src/lib/persistence.ts:68-125`), then validates the
  telemetry's complete nested shape (`apps/web/src/lib/persistence.ts:327-390`)
  and cross-result financial coherence
  (`apps/web/src/lib/analysis-result.ts:234-420`). Browser views use ordinary
  escaped Svelte interpolation; standalone report values still pass through
  the existing HTML escaping boundary.
- The repaired dependency gate parses the committed lock as data, rejects
  malformed metadata and unsupported locators/ranges, resolves the nearest
  valid peer, and checks required and present optional peers
  (`scripts/check-dependencies.ts:122-221,224-345,347-430`). It does not execute
  lockfile content or expand CI authority. The frozen graph now passes this
  gate and the package-manager advisory audit.

## Whole-tree trust-boundary result

- Browser admission remains bounded at 10 MiB per file, 50 MiB per batch, and
  50 files. ZIP metadata is checked without inflation for compressed size,
  entry count, per-entry and total expansion, ratio, encryption, methods,
  ZIP64/multi-disk markers, local/central agreement, and byte ranges before
  SheetJS receives an offset-zero ZIP
  (`packages/parser/src/shared/xlsx-archive.ts:1-298`).
- Persisted input cannot reach a prototype-writing merge or raw markup sink.
  Shape and semantic checks build and consume domain values only. The sole
  production `{@html}` site selects repository-owned static icon strings
  (`apps/web/src/components/ui/Icon.svelte:1-60`).
- External card links must be unchanged absolute HTTP(S) URLs without
  credentials, padding, or controls
  (`packages/rules/src/security.ts:18-56`). Svelte escapes their attributes and
  visible host text, and the link uses `noopener noreferrer`.
- Remote PDF parsing remains opt-in, local-first, and PDF-only. Consent binds
  the request to the captured byte count and digest; mutation before or during
  the retry fails closed. Input and provider output are bounded, and returned
  transaction dates, merchants, and amounts are validated before use.
- Scraper URLs require an exact normalized allowed host, public-only DNS
  answers, a pinned lookup, and connected-address verification. Every redirect
  repeats the policy; response type, encoding, redirect count, bytes, and the
  operation deadline are bounded. Page text is JSON-encoded and marked
  untrusted before the LLM. Model-authored URLs are deleted, trusted issuer and
  date fields are stamped outside the model, and every claimed supported
  reward is quarantined as `pending_source_review` before schema validation.
- CLI report and scraper writers retain and revalidate trusted directory
  capabilities, reject links and non-regular destinations, use private
  exclusive no-follow temporaries, and revalidate immediately before commit.
  The CLI scraper wrapper passes an exact executable and argument vector to
  `spawnSync` without a shell. Terminal text strips control and bidi sequences,
  and standalone report dynamic values are escaped under a script-free CSP.
- The deployment workflow has empty top-level permissions, gives the
  untrusted-code build job only `contents: read`, disables checkout credential
  persistence, uses a frozen lock, and pins every action to a full commit SHA
  (`.github/workflows/deploy.yml:3-46`). Pages upload and the job with
  Pages/OIDC write authority are limited to manual dispatch or a push to
  `main`; pull requests cannot enter either path
  (`.github/workflows/deploy.yml:48-79`).

## Historical reconciliation and rejected candidates

All 1,169 current `.context` review and plan paths were inventoried. Security
themes and the implementation boundaries of prior findings were searched
across the full corpus, with the Cycle 13 security report and aggregate used as
the immediate deduplication baseline. The following candidates are explicitly
**not** promoted as Cycle 14 findings:

| Candidate | Status and evidence |
|---|---|
| Untracked Cycle 42 `safeJSONParse` key-list claim | **Rejected — unsupported and already deduplicated.** `constructor.prototype` is not a single JSON property key; nested object keys, including objects inside arrays, still pass through the reviver. Exact `constructor`, `prototype`, `__proto__`, and legacy accessor names are rejected at every depth, only plain objects survive, and exhaustive shape/coherence validation precedes use (`apps/web/src/lib/persistence.ts:68-125`). The candidate identifies no prototype-writing sink or reproducing payload. A misspelled `__proto` property is ordinary inert data and is rejected wherever the current payload schema does not permit it. |
| Untracked Cycle 42 CSP `unsafe-inline` carryover | **Rejected — known pre-existing defense-in-depth limitation, not a new root.** The exception and static-host limitation are documented in source and README (`apps/web/src/layouts/Layout.astro:53-71`, `README.md:139-141`). The current delta adds no executable-content sink; Svelte text/attributes remain escaped and the only raw sink is the closed icon table. |
| Prefixed or leading-NUL XLSX ZIP inflation | **Rejected again with a corrected in-memory reproduction.** A real workbook named `OriginalLedger` was serialized, prefixed with `0x00`, and passed through both preflight and the production package parser. Bytes began `[0,80,75]`; preflight returned `kind: "not-zip"`; direct SheetJS parsing produced a new text/PRN `Sheet1` whose first cell contained raw `PK`/XML bytes rather than the original workbook; production parsing returned zero transactions and `헤더 행을 찾을 수 없습니다.` Offset-zero `PK` is the only ZIP admission path (`packages/parser/src/shared/xlsx-archive.ts:118-132`). No archive entry was inflated, so there is still no evidence for the proposed bypass. |
| Regex HTML-normalization bypass/ReDoS variants | **Rejected — historical duplicate and non-sink.** HTML normalization feeds statement parsing and is never rendered. Browser file-size admission and a disposable parser worker bound the client path; the current delta does not touch the normalizer. |
| Old console-warning “data leak” and amount-regex denial candidates | **Rejected — historical/unsupported.** Logged card identifiers and public catalog values are not secrets, raw statements are not logged, terminal errors are sanitized, and file admission/worker isolation remain unchanged. No new input-to-secret or input-to-unbounded-main-thread path was reproduced. |
| Plaintext same-origin `sessionStorage`, PDF prompt-injection/JSON-extraction limits, and whole-file CLI parser resource redesign | **Rejected — known pre-existing limitations/deferred architecture, not current regressions.** Persistence contents and privacy are disclosed; remote PDF data is explicitly consented, bounded, and validated; no current change widens these boundaries. |
| Pull-request verification or manual dispatch could publish untrusted PR code | **Rejected — contradicted for PRs and duplicate for dispatch.** PRs receive neither Pages nor OIDC write authority and fail both publication conditions. The operator-authorized pre-existing `workflow_dispatch` route is not a Cycle 14 change. |

Prior findings for action pins, workflow permissions, terminal controls,
subprocess arguments, report/scraper filesystem races, captured-byte consent,
diagnostic amplification, XLSX expansion, scraper SSRF/source authority,
private card identifiers, model-authored URLs, and source-link validation
remain closed at current HEAD.

## Read-only verification and final missed-file sweep

- `bun run dependencies:check` passed: manifests, production imports, peer
  contracts, remote dependency references, vendored archive references, and
  SHA-256/SHA-512 digests are valid.
- `bun audit` completed successfully with **no vulnerabilities found**.
- `bun run data:check` parsed all **683** card YAML files and verified every
  generated catalog, public shard, fallback label file, and README catalog
  without drift.
- A focused trust-boundary suite passed **443 tests across 20 files** with
  **0 failures** and 1,733 assertions. It covered workflow and dependency
  policy, CLI argument/consent/captured-byte boundaries, report and scraper
  filesystem races, SSRF/DNS/redirect/body/deadline controls, LLM input/output
  quarantine, external URLs, workers, persistence/prototype/coherence checks,
  XLSX archive bombs, and catalog security validation.
- The complete tracked credential-pattern scan found no key/certificate
  container, private-key marker, or provider credential. Four matches are
  explicit synthetic negative-test values in
  `tools/scraper/__tests__/args.test.ts`,
  `tools/scraper/__tests__/cli.test.ts`,
  `tools/scraper/__tests__/runtime-config.test.ts`, and
  `tools/scraper/__tests__/writer.test.ts`; their names and assertions make
  them non-credentials, and tests verify they are not logged or published.
- Every workflow action is pinned to exactly 40 lowercase hexadecimal
  characters. The tracked tree contains no symbolic link or Git submodule.
  `git diff --check 3e2d663..HEAD` passed.
- The mandatory final pattern and missed-file sweep revisited every environment
  read, network call, dynamic/raw-content sink, subprocess, filesystem
  mutation, public markup/configuration path, authentication applicability,
  secrets/logs, URL schemes, parser/archive limits, persistence/prototype
  handling, worker message validation, LLM authority, traversal/symlink/
  TOCTOU defenses, dependency origin, CI permissions/artifacts, action pins,
  and every current repair file. It found no reproducible new issue.
- The six protected untracked Cycle 42 artifacts remained byte-identical,
  untracked, unstaged, and uncommitted, with SHA-256 prefixes
  `596dc919`, `272a7077`, `1dbdd1bd`, `6c6aa0d1`, `c7909307`, and
  `c3fbf7a4`.

Final count: **0 new findings**.
