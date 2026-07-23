# Review-plan-fix Cycle 13 — security reviewer

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: OWASP Top 10, secrets, unsafe parsing/content handling, injection/XSS,
  authentication/authorization, browser isolation, privacy, SSRF/path risks,
  workflow and dependency supply chain, and cross-file trust boundaries
- Method status: **confirmed by manual static source/history review plus
  read-only targeted validation**
- Disposition: **pass — no genuinely new current-HEAD security finding**
- Scope: review and this report only; no implementation, source/test/generated
  artifact change, staging, commit, push, deployment, browser, server, or
  external-system mutation

## Finding count and required fields

**Final count: 0 new findings.**

There is no finding row to which a severity, confidence, confirmed/likely/manual
status, exploit or failure scenario, or suggested fix can truthfully be
assigned. No Critical, High, Medium, or Low candidate met both the current-HEAD
evidence threshold and the requirement that it be genuinely new.

## Inventory and review coverage

The closing inventory classified all **2,318 tracked paths**:
**1,152** `.context` review/plan paths and **1,166** active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths. The active
inventory includes:

- web: 80 production source paths;
- core: 26 production source paths;
- parser: 35 production source paths;
- rules: 14 production source paths and all 683 authored card YAML files;
- visualization: 9 production source paths;
- CLI: 16 production source paths;
- scraper: 12 production source paths;
- 19 scripts and 176 combined unit/integration/E2E test-like paths; and
- all remaining generated/public artifacts, manifests, lockfile, workflow,
  compiler/build configuration, documentation, and vendored SheetJS integrity
  files.

High-volume authored/generated card data was assessed at its schema, semantic
validation, source-hash, publication, runtime-reader, and rendering
boundaries. The complete cross-file trace covered:

1. browser upload admission, format detection, every parser family, shared
   XLSX archive preflight, parser/optimizer worker messages and ownership,
   bounded diagnostics, persistence parsing/coherence, and Astro/Svelte sinks;
2. CLI path admission, local-first statement parsing, captured-byte identity,
   explicit remote-LLM consent, Anthropic request/response bounds, terminal
   output, standalone-report escaping/CSP, and safe output commits;
3. scraper argument and issuer policy, exact host admission, public-only DNS,
   pinned connections, redirect revalidation, bounded HTML reads, untrusted
   page-to-LLM authority, model-output quarantine, schema validation, and safe
   filesystem publication;
4. canonical card/rule/cap identities, external URLs, rules/catalog schemas,
   authored YAML, generated browser JSON, source identity, and final link/text
   rendering; and
5. environment reads, credential-shaped literals, subprocesses, filesystem
   operations, dependency manifests/lock/overrides, vendored digests, action
   pins, workflow permissions, artifact paths, and Pages publication gates.

The deployed application remains static and client-only. It has no application
account, cookie, server session, database, privileged mutable API, or role
surface, so application authentication and server-side authorization are not
applicable. The material authorization decision is the CLI consent boundary
before extracted PDF text may leave the machine.

## Current repair-delta result

The independent review of every active-code change from the Cycle 12 baseline
`e72a4c69f7c0eab7053c61a587c2d040760c236c` to the reviewed revision found no
new security weakness.

- The rule/cap identity repair keeps both identities in bounded schema-owned
  strings, separates rule execution from shared cap accounting, and rejects
  conflicting cap definitions for the same performance tier before
  publication (`packages/rules/src/schema.ts:225-249`,
  `packages/rules/src/catalog-validation.ts:407-459`,
  `packages/core/src/calculator/reward.ts:127-148,769-1040`). These values are
  Map keys and escaped display data, never executable code, property-path
  writes, or attacker-authored regular expressions.
- New browser cap disclosures interpolate values through ordinary Svelte text
  expressions, so card/category strings cannot become markup
  (`apps/web/src/lib/cap-disclosures.ts:12-50`,
  `apps/web/src/components/ui/CapDisclosures.svelte:14-40`). The standalone
  HTML report still escapes the dynamic card and category values
  (`packages/viz/src/report/generator.ts:390-430`).
- The scraper repair skips normalized-empty selectors and rejects empty source
  input before an LLM call. It tightens rather than expands the input boundary
  (`tools/scraper/src/fetcher.ts:317-359`,
  `tools/scraper/src/extractor.ts:38-53`). Page content remains JSON-encoded and
  explicitly delimited as untrusted; model URLs are deleted, rewards are
  quarantined, and canonical validation precedes return
  (`tools/scraper/src/extractor.ts:71-130,148-220`).
- The CLI performance repair avoids ordinary-local eager reads and avoids
  copies only for the uniquely owned `fs.readFile` Buffer. A remote-enabled
  operation hashes one captured sequence, supplies that same sequence to both
  local and remote parsing, verifies it before consent, again before retry,
  and after retry, and identifies the consent object by digest and byte size
  (`tools/cli/src/parse-statement.ts:39-128`). The production retry is PDF-only
  and the production PDF extraction path reads rather than mutates the buffer
  (`packages/parser/src/statement.ts:51-112`,
  `packages/parser/src/pdf/extractor.ts:37-63`,
  `packages/parser/src/pdf/index.ts:37-110`).
- Root `parse` now delegates to the existing `analyze` command; source-host
  contrast is CSS-only; and prompt wording now matches the already enforced
  trusted-stamping behavior. None adds a new data, command, URL, or privilege
  boundary.
- Pull requests now run the existing repository and browser verification under
  the ordinary `pull_request` event. Top-level permissions remain empty, the
  build job has only `contents: read`, checkout credential persistence is
  disabled, dependencies use the frozen lock, and every action is pinned to a
  full commit SHA (`.github/workflows/deploy.yml:3-46`). Pages artifact upload
  and the write/OIDC-capable deploy job are both limited to an explicit manual
  dispatch or a push to `main`; pull requests cannot enter either path
  (`.github/workflows/deploy.yml:48-79`).

## Whole-tree trust-boundary result

The broader current boundaries remain fail-closed:

- Browser admission caps one file at 10 MiB, a batch at 50 MiB, and the count
  at 50 before parsing (`apps/web/src/lib/upload-admission.ts:3-70`). ZIP
  metadata is inspected without inflation for compressed size, entry count,
  per-entry/total expansion, ratio, encryption, methods, ZIP64/multi-disk
  markers, header agreement, and byte ranges before SheetJS receives an XLSX
  archive (`packages/parser/src/shared/xlsx-archive.ts:1-298`).
- Persisted JSON rejects prototype-related keys at every depth, requires plain
  objects, validates nested numeric/string/container shapes, and verifies
  financial coherence before restoration
  (`apps/web/src/lib/persistence.ts:68-125,624-825`). The sole production raw
  HTML sink selects only repository-owned static SVG path strings
  (`apps/web/src/components/ui/Icon.svelte:1-60`).
- External card URLs must remain unchanged absolute HTTP(S) URLs without
  credentials, padding, or control characters before `URL` derives the shown
  host (`packages/rules/src/security.ts:18-56`,
  `apps/web/src/lib/external-url.ts:8-21`). The link uses escaped Svelte
  attributes/text and `noopener noreferrer`
  (`apps/web/src/components/cards/CardDetail.svelte:268-286`).
- Local PDF parsing precedes the typed fallback signal and explicit consent.
  Remote input is complete-or-rejected at 8,000 characters, provider output is
  bounded, truncation fails closed, and every returned transaction is
  structurally, numerically, and calendrically validated
  (`packages/parser/src/pdf/llm-fallback.ts:55-243`,
  `tools/cli/src/consent.ts:14-81`).
- Report and scraper writers validate containment, directory ownership/mode
  and stable identity, retain directory handles, reject links/non-regular
  destinations, create private exclusive no-follow temporaries, and
  revalidate before commit and cleanup
  (`tools/cli/src/report-output.ts:75-323`,
  `tools/scraper/src/writer.ts:106-403`).
- Scraper URLs require an exact allowed normalized host and HTTP(S) without
  credentials. Every DNS answer must be public, the lookup is pinned, the
  connected socket must match a validated answer, and every redirect repeats
  validation (`tools/scraper/src/network-policy.ts:162-324`,
  `tools/scraper/src/fetcher.ts:220-314`). Response media type, content
  encoding, redirect count, body bytes, and the single operation deadline are
  bounded.

## Historical reconciliation and rejected candidates

I enumerated all 94 security-named, aggregate, repair-plan, and deferred-index
files under `.context`, used the complete Cycle 12 full-tree security review as
the immediate baseline, and rechecked the current source boundaries associated
with earlier findings. The following are explicitly **rejected from Cycle 13
NEW findings**:

| Candidate | Disposition |
|---|---|
| Cycle 41/42 `safeJSONParse` prototype-key-list claim | **Rejected — duplicate and unsupported on current code.** Exact dangerous property keys are rejected by the reviver at every depth; only plain objects survive; exhaustive shape and coherence validation precedes use. No candidate supplied a prototype-writing merge sink or a reproducible payload (`apps/web/src/lib/persistence.ts:68-125,624-825`). |
| Cycle 22-41 regex HTML-normalization bypass variants | **Rejected — historical duplicate/non-sink.** Normalized HTML is input to statement parsing and is never rendered. The only production raw sink is the closed static icon table. This remains a known defense-in-depth limitation, not a new exploit path. |
| `unsafe-inline` CSP, unavailable static-host response headers/frame headers, and plaintext same-origin `sessionStorage` | **Rejected — known pre-existing limitations.** The CSP exception is documented in source (`apps/web/src/layouts/Layout.astro:53-71`); storage privacy is disclosed in the store. The current delta did not widen either boundary. |
| PDF LLM blacklist/prompt-injection limitation, whole-file parser resource redesign, LLM JSON extraction, and prior OFX-regex candidates | **Rejected — historical duplicates.** The current delta does not change these paths; current remote requests and outputs remain bounded and validated. |
| Shared captured Buffer could be mutated after zero-copy repair | **Rejected — new hypothesis without a production exploit path.** The production snapshot is uniquely owned, the only remote retry is the read-only PDF path, and digest checks surround consent and retry. A deliberately malicious injected test dependency is not an application trust boundary; no real parser-induced mutation was found. |
| Pull-request verification could publish or acquire deployment authority | **Rejected — contradicted by current workflow.** PRs receive no Pages/OIDC write permissions and fail both explicit upload/deploy conditions. Standard PR code execution occurs only in the isolated read-only verification job; no repository secret is exposed. The pre-existing operator-authorized `workflow_dispatch` publication path is not a Cycle 13 regression. |
| Prefixed/leading-NUL XLSX ZIP inflation | **Rejected again — no new reproducible evidence.** Preflight enters ZIP inspection only when bytes zero and one are `PK`; non-`PK` input returns `not-zip` and follows the legacy/plaintext dispatch (`packages/parser/src/shared/xlsx-archive.ts:113-132`). The current trace and archive tests supplied no evidence that SheetJS treats such a prefix as a ZIP archive, so the expressly rejected hypothesis is not resurrected. |

Earlier action-pin, workflow-permission, subprocess, terminal-control,
filesystem identity/TOCTOU, captured-byte consent, diagnostic amplification,
XLSX expansion, scraper SSRF/source authority, private card-ID, model-authored
URL, and source-link findings remain closed at their current implementations.

## Read-only verification and final missed-issue sweep

- `bun run dependencies:check` passed: manifests, production imports, remote
  dependency references, vendored archives, and pinned digests are valid.
- `bun audit` completed successfully with **no vulnerabilities found**.
- A targeted trust-boundary suite passed **363 tests across 18 files** with
  zero failures. It covered workflow privilege/publication gates, CLI consent
  and captured-byte mutation rejection, report/scraper filesystem races,
  scraper SSRF/redirect/body/deadline controls, LLM input/output quarantine,
  browser URL guards, workers, persistence/prototype/coherence checks, XLSX
  archive bombs, cap identity/disclosure, and catalog security validation.
- The tracked-tree credential sweep found no private-key marker, credential
  container, or provider-format AWS, Anthropic, GitHub, Slack, Google, OpenAI,
  or PGP private secret. One broad `sk-...` shape is deliberately used as
  adversarial injected metadata in a scraper writer test; it is not a valid
  provider credential and is never used for authentication. Runtime provider
  keys remain environment-only and are not logged.
- Every workflow action reference is a full 40-hex commit SHA. The tracked
  tree contains no symbolic link or Git submodule boundary.
- `git diff --check e72a4c6..HEAD` passed.
- The six protected untracked Cycle 42 artifacts retained their original
  SHA-256 values and remained unstaged:
  `596dc919...`, `272a7077...`, `1dbdd1bd...`, `6c6aa0d1...`,
  `c7909307...`, and `c3fbf7a4...`.

The mandatory closing sweep revisited auth/authz applicability, secrets and
logs, XSS/raw HTML and DOM sinks, terminal controls, URL schemes and displayed
destinations, SSRF/DNS rebinding/redirects, upload/parser/archive resource
limits, deserialization/prototype keys, worker isolation and message
validation, LLM input/output authority, storage privacy, traversal/symlink/
TOCTOU writes, temporary cleanup, subprocess argument handling, dependency
provenance, workflow privilege and artifacts, action pins, and every active
repair diff. It found no genuinely new current-HEAD security issue.

Final count: **0 new findings**.
