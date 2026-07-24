# Review-plan-fix Cycle 15 — security reviewer

- Date: 2026-07-24
- Reviewed revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: OWASP Top 10, secrets, unsafe parsing and data flow, injection/XSS,
  authentication/authorization, privacy, browser and worker boundaries,
  SSRF/path/TOCTOU risks, denial of service and resource limits, dependencies,
  CI/workflow trust, and cross-file interactions
- Method status: **complete manual whole-tree/history review plus narrow
  read-only validation**
- Disposition: **pass — no genuinely new current-HEAD security finding**
- Scope: this review and report only; no source, test, generated artifact,
  plan, dependency, staging, commit, push, deployment, server, browser, or
  external-system mutation

## Finding count and required fields

**Final count: 0 new findings.**

No candidate met both required thresholds: reproducibility on the exact
reviewed revision and genuine novelty after reconciliation with archived and
current findings. There is therefore no finding to which an exact file/line,
severity, confidence, confirmed/likely/manual-validation status, concrete
exploit or failure scenario, or root fix can truthfully be assigned. No
Critical, High, Medium, or Low finding is retained.

## Inventory and coverage

The closing inventory classified all **2,354 tracked paths**: **1,185**
`.context` paths (872 reviews and 313 plans) and **1,169** active product,
data, test, documentation, workflow, configuration, and vendor-integrity
paths. Every tracked blob was included in an exact-HEAD archive
content/readability pass (archive SHA-256
`1a792a206ee41b27ace177ba84f3e5f1e5ed3d9fbf60d2d3f043bcc7ffaed885`).
The active inventory includes:

- 80 web production source paths and 32 public artifacts;
- 26 core, 35 parser, 14 rules, and 9 visualization production source paths;
- all 683 authored card YAML files and their generated catalogs;
- 16 CLI production paths, 12 scraper production paths, and all 10 scraper
  issuer targets;
- all 19 TypeScript paths under `scripts/` and 179 unit/integration/E2E
  test-like paths; and
- the remaining manifests, lockfile, workflow, compiler/build/test
  configuration, documentation, license, and vendored SheetJS archive and
  checksums.

The semantic review traced browser file admission through format detection,
all parser families, XLSX archive preflight, disposable parser workers,
categorization, optimizer workers, persistence, and every rendered/exported
sink. It also traced CLI argument and path handling, local-first PDF parsing,
remote-LLM consent and captured-byte identity, terminal/report output,
scraper URL/DNS/redirect/body policy, LLM authority quarantine, filesystem
publication, catalog authoring and browser reads, subprocess invocation,
environment reads, dependency provenance, and CI publication authority.

The deployed application is static and client-only. It has no application
account, authentication cookie, server session, database, privileged mutable
API, or role surface, so application login authentication and server-side
authorization are not applicable. The material authorization decision is the
explicit CLI consent boundary before locally extracted PDF text may be sent
to Anthropic.

## Current repair-delta result

The active delta from the Cycle 14 reviewed baseline
`5260bbd9b6f44ff35cf1bb9a11819354003e5161` contains three modified production
files and one new test: 411 insertions and 7 deletions. It adds an
optimizer-only shortcut for cap-loss counterfactual replay. No parser,
network, filesystem, credential, browser-rendering, authorization, or
deployment boundary changed.

- `PreparedCardRule` is still created only after the shared reward structure
  checks. It records whether the card has any cap and whether executable rules
  carry `maxUses` or fixed-per-day state, is frozen, and carries a
  module-private symbol (`packages/core/src/calculator/reward.ts:128-190`).
  The internal constructor and prepared calculator are absent from the public
  package barrel (`packages/core/src/index.ts:53-68`) and are not exposed by
  the package export map.
- The new prefix assertion is fail-closed. It is accepted only while cap
  suppression collection is enabled and only when
  `capSuppressionStartIndex` identifies the one appended transaction. The
  kernel actually skips prefix counterfactual work only when the prepared card
  also proves that no executable reward is stateful
  (`packages/core/src/calculator/reward.ts:1117-1200,1202-1265`).
  Stateful reservation advancement and incompleteness detection remain on the
  full path (`packages/core/src/calculator/reward.ts:1563-1663`).
- Only append scoring supplies the assertion. It derives it from
  `collectPortfolioTelemetry && preparedCardRule.hasRewardCap`
  (`packages/core/src/optimizer/greedy.ts:208-271`). The enclosing
  `portfolioCapLossesComplete` latch begins true, is passed into scoring, and
  can transition only to false after incomplete or irreconcilable evidence;
  later calls cannot re-enable the shortcut
  (`packages/core/src/optimizer/greedy.ts:637-681,695-751`). Final card replay
  can still invalidate completeness, and incomplete telemetry remains omitted
  rather than published as authoritative
  (`packages/core/src/optimizer/greedy.ts:846-978`).
- The public `calculateRewards` boundary still performs its structural
  validation, safe-integer checks remain in both calculator and optimizer
  paths, and canonical schema/worker/catalog readers prevent malformed
  untrusted rule objects from entering the browser path. The change reduces
  repeated work; it introduces no new executable-data or privilege boundary.

No integrity failure was reproduced in this path. Its focused regression file
passed all 5 tests and 28 assertions, including malformed proof combinations,
stateful `maxUses` and fixed-per-day retention, direct/public fail-closed
behavior, and optimizer append scoring.

## Whole-tree trust-boundary result

- Browser admission remains bounded at 10 MiB per file, 50 MiB per batch, and
  50 files (`apps/web/src/lib/upload-admission.ts:3-68`). Parser diagnostics
  are capped in count and string length, large parsing runs execute in
  disposable workers, and worker requests are terminated on completion,
  error, or cancellation.
- ZIP metadata is inspected without inflation before SheetJS receives an
  offset-zero `PK` archive. Compressed size, entry count, per-entry and total
  expansion, compression ratio, encryption, methods, ZIP64/multi-disk
  markers, central/local agreement, and byte ranges are bounded or rejected
  (`packages/parser/src/shared/xlsx-archive.ts:118-298`).
- Persisted JSON rejects exact prototype-related and legacy accessor property
  names at every reviver depth, accepts only plain objects at domain
  boundaries, and then passes exhaustive shape and financial-coherence checks
  (`apps/web/src/lib/persistence.ts:68-125`). No persisted value reaches a
  prototype-writing merge or raw markup sink.
- The sole production Svelte `{@html}` sink selects only repository-owned
  static icon fragments (`apps/web/src/components/ui/Icon.svelte:1-60`).
  Ordinary catalog, transaction, warning, and report values are escaped.
  External links must be unchanged absolute HTTP(S) URLs without credentials,
  surrounding whitespace, or controls
  (`packages/rules/src/security.ts:30-56`) and are rendered with
  `noopener noreferrer`.
- Remote PDF parsing remains PDF-only, local-first, explicit-consent gated,
  and bound to the captured byte count and digest. Provider input, output
  tokens, extracted JSON, dates, merchant presence, and positive safe-integer
  amounts are bounded or validated; browser invocation is prohibited
  (`packages/parser/src/pdf/llm-fallback.ts:61-220`).
- Scraper targets require exact normalized allowed hosts, public-only DNS
  answers, a pinned lookup, and connected-address agreement. Every redirect
  repeats validation; redirects, body bytes, media type, encoding, and the
  total operation deadline are bounded
  (`tools/scraper/src/network-policy.ts:180-323`;
  `tools/scraper/src/fetcher.ts:21-315`). Scraped text is marked untrusted
  before the model; issuer/source/date authority is stamped outside the
  model, model URLs are removed, and model-supported rewards remain
  quarantined pending trusted review.
- CLI report and scraper writers retain and revalidate trusted directory
  handles, reject links and unsafe destinations, use private exclusive
  no-follow temporaries, and revalidate before atomic commit. The CLI scraper
  wrapper passes an exact executable and argv vector to `spawnSync` without a
  shell. Terminal controls and bidi characters are stripped; standalone
  report data is escaped under a script-free CSP.
- The workflow has empty top-level permissions, gives the build job only
  `contents: read`, disables checkout credential persistence, uses a frozen
  lock, and pins all seven actions to 40-character lowercase hexadecimal
  commits (`.github/workflows/deploy.yml:3-46`). Pages artifact upload and the
  Pages/OIDC write job are limited to manual dispatch or a push to `main`;
  pull requests cannot enter either path
  (`.github/workflows/deploy.yml:48-79`).

## Historical reconciliation and rejected candidates

All 1,185 tracked `.context` paths were inventoried. Broad security/theme
searches covered 634 relevant review/plan files and 212 security-specific
headings; 93 security-reviewer/aggregate documents and the current repair
lineage were read as the focused deduplication corpus. The Cycle 14 security
report and aggregate were the immediate baseline. The following candidates
are explicitly **not** promoted as Cycle 15 findings:

| Candidate | Status and current-HEAD evidence |
|---|---|
| Untracked Cycle 42 `safeJSONParse` key-list claim | **Rejected — unsupported and already deduplicated.** `constructor.prototype` is not one JSON key, objects nested in arrays still pass through the reviver, and exact `constructor`, `prototype`, `__proto__`, and legacy accessor names are rejected at every depth. Only plain objects and fully validated domain shapes survive (`apps/web/src/lib/persistence.ts:68-125`). No prototype-writing sink or reproducing payload is identified. |
| Prefixed/leading-NUL XLSX ZIP inflation | **Rejected and not resurrected.** Offset-zero `PK` remains the only archive admission path (`packages/parser/src/shared/xlsx-archive.ts:118-132`). Prior corrected in-memory reproduction showed prefixed bytes take the non-ZIP/text path, do not inflate entries, and produce no transactions. The current delta does not touch this boundary and supplies no new contrary evidence. |
| CSP `unsafe-inline` and static-host response-header limits | **Known pre-existing defense-in-depth limitation, not a new root.** The exception is documented in source (`apps/web/src/layouts/Layout.astro:53-66`), and the current delta adds no executable-content sink. Svelte text/attributes remain escaped and the only raw sink is the closed icon table. |
| Historical OFX dynamic-regex and JSON prototype-chain findings | **Closed at current HEAD.** Dynamic OFX tag names are escaped before regex construction (`packages/parser/src/shared/ofx.ts:171-188`), and JSON field selection uses `Object.hasOwn` rather than `in` (`packages/parser/src/shared/json.ts:73-91`). |
| HTML upload/normalization XSS claims | **Rejected as duplicate non-sink observations.** HTML is parsed as statement data in a worker and is never rendered as markup. Browser admission is bounded. Parser normalization is not an HTML-sanitization authority and the current change does not touch it. |
| Plaintext same-origin `sessionStorage`, PDF prompt/JSON-extraction limitations, OFX/amount-regex concerns, CLI whole-file resource redesign, and browser transaction-count/optimizer complexity | **Known historical or deferred limitations, not current regressions.** The delta narrows optimizer work and does not widen any of these boundaries. |
| Missing dependency advisory control / vulnerable lock graph | **Previously valid, now closed.** The current frozen graph passes the repository provenance/peer/vendor gate and `bun audit` reports no vulnerabilities. No new remote dependency source or mutable workflow reference was added. |
| Pull-request or manual-dispatch publication claims | **Rejected for PRs and duplicate for dispatch.** PR jobs have read-only content authority and fail both publication conditions. The operator-authorized manual route predates Cycle 15. |

Earlier fixes for action pins and permissions, terminal controls, subprocess
arguments, report/scraper filesystem races, captured-byte remote consent,
diagnostic amplification, XLSX expansion, scraper SSRF and source authority,
private card identifiers, model-authored URLs, source-link validation, and
dependency advisories remain closed at current HEAD.

## Read-only verification and final missed-file sweep

- `bun run dependencies:check` passed: manifests, production imports, peer
  contracts, remote references, vendored references, and archive digests are
  valid.
- `bun audit` completed successfully with **no vulnerabilities found**.
- The focused current-delta test passed **5 tests**, **28 assertions**, and
  **0 failures**.
- `git diff --check
  5260bbd9b6f44ff35cf1bb9a11819354003e5161..HEAD` passed.
- The complete tracked credential-pattern scan found no private-key marker,
  key/certificate container, AWS, GitHub, Slack, or Google credential.
  Four Anthropic-shaped matches are confined to explicit scraper test
  fixtures in `args.test.ts`, `cli.test.ts`, `runtime-config.test.ts`, and
  `writer.test.ts`; production obtains the key only from its environment and
  the tests exercise rejection/non-disclosure behavior.
- All seven workflow actions are commit-pinned. The tracked tree has no
  symbolic link or Git submodule. The vendored SheetJS archive SHA-256 is
  `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`,
  exactly matching the committed checksum.
- The final missed-issue sweep revisited every current repair file,
  environment read, network call, dynamic/raw-content sink, subprocess,
  filesystem mutation, public markup/configuration path, secrets/logging
  boundary, URL scheme, parser/archive limit, persistence/prototype boundary,
  worker protocol, LLM authority boundary, traversal/symlink/TOCTOU defense,
  dependency source, CI permission/artifact condition, and action reference.
  No reproducible new issue remained.
- The six protected untracked Cycle 42 artifacts remained byte-identical,
  untracked, unstaged, and uncommitted, with SHA-256 prefixes
  `596dc919`, `272a7077`, `1dbdd1bd`, `6c6aa0d1`, `c7909307`, and
  `c3fbf7a4`.

Final count: **0 new findings**.
