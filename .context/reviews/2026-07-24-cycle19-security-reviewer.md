# Cycle 19 security review

## Result

No genuinely new security finding was retained at
`fcc89801451d1c1a31bb9881d213e117fc4ca923`.

- Novel security findings: **0**
- Confidence: **High** for the Cycle 18 delta and **medium-high** for the
  whole-tree negative result
- Review mode: defensive source, configuration, artifact, history, and focused
  gate inspection; no browser, E2E, deployment, publication, or source change
- Non-security handoff: one confirmed Low reliability regression at the
  `0000-01` persistence/coherence boundary is documented by the Cycle 19
  debugger and verifier. It does not cross a security boundary and is not
  counted here.

## Inventory and trust boundaries

I inventoried all 2,409 tracked paths: 1,237 tracked `.context` paths and
1,172 active paths. The active security inventory covered:

| Surface | Files | Boundaries inspected |
| --- | ---: | --- |
| `.github/` | 1 | event authority, job permissions, pinned actions, Pages publication |
| `apps/web/` | 172 | upload limits, workers, same-origin catalog reads, rendering, external URLs, persistence, framing |
| `packages/core/` | 47 | numeric/date admission, calculation invariants, bounded analysis state |
| `packages/parser/` | 86 | file detection, text/JSON/OFX/HTML/PDF/XLSX parsing, archive and worksheet limits |
| `packages/rules/` | 734 | 683 authored cards, schemas, catalog validation, generated artifacts |
| `packages/viz/` | 14 | escaped terminal/report presentation |
| `tools/cli/` | 28 | argument/file boundaries, remote-model consent, report output |
| `tools/scraper/` | 35 | credential use, URL/DNS/redirect policy, response bounds, quarantine and safe writes |
| `scripts/` | 21 | generation, dependency/vendor checks, E2E process ownership |
| `e2e/` | 16 | browser isolation and security regressions |
| `vendor/` | 3 | authenticated SheetJS archive and checksum |
| root/configuration | 15 | manifests, lock, task graph, toolchain and test configuration |

The principal traces were browser file admission to bounded worker parsing and
session persistence; CLI file admission to explicit remote-model consent;
scraper URL admission to public-address pinning and no-follow publication; and
authored YAML to canonical validation, identity-bound generated artifacts, and
same-origin readers.

## Cycle 18 delta review

The complete 66-path delta from `c182c81` was inspected: 21 plan/review paths,
six implementation paths, nine tests, and 30 generated artifacts.

- `packages/core/src/analysis/context.ts:3-114` replaces the permissive public
  month type with a runtime-refined brand, preserves four-digit predecessors,
  and makes the unrepresentable lower boundary explicit. It adds no privilege,
  network, file, markup, or code-execution capability.
- `scripts/catalog-publication.ts:93-136,353-412` canonicalizes identity-free
  projections and injects the resulting SHA-256 only afterward.
  `scripts/build-json.ts:301-400` includes both validated legacy projections
  under distinct stable keys and gives their changed contract version `2.0.0`.
  No authored label or identifier is interpreted as code.
- `scripts/check-dependencies.ts:11-22,465-510,532-692` admits `.mts` and
  `.cts` through the existing TypeScript import classifier. It neither executes
  reviewed sources nor relaxes runtime dependency ownership.
- Generated catalog outputs carry one common publication identity across the
  three legacy copies, browser summary, optimizer, categories, and 24 issuer
  shards. Canonical drift validation passed for 683 cards and 24 issuers.

## Defensive sweep and disposition

### Confirmed controls

- A tracked credential-marker scan found no live credential material outside
  synthetic key-validation fixtures. Runtime Anthropic credentials remain
  environment-only (`packages/parser/src/pdf/llm-fallback.ts:210-234`;
  `tools/scraper/src/cli.ts:34-64`).
- Browser raw HTML remains limited to the repository-owned icon table; dynamic
  financial/card text is rendered through escaped framework bindings
  (`apps/web/src/components/ui/Icon.svelte:1-83`).
- Persistence rejects prototype-affecting keys and validates complete domain
  shapes before accepting state (`apps/web/src/lib/persistence.ts:68-125,
  522-547,720-922`).
- Scraper network and write boundaries retain public-address enforcement,
  redirect revalidation, response/deadline limits, schema validation,
  no-follow traversal checks, and exclusive/atomic publication
  (`tools/scraper/src/network-policy.ts:1-271`;
  `tools/scraper/src/fetcher.ts:87-317`;
  `tools/scraper/src/writer.ts:114-405`).
- CI retains empty top-level permissions, job-scoped authority, immutable
  actions, disabled checkout credentials, frozen installation, verification,
  and a separately authorized deploy job
  (`.github/workflows/deploy.yml:1-68`).
- `bun audit --json` returned an empty advisory object on this review host.
  The blocking dependency, vendor-digest, peer, remote-reference, and direct
  import policy also passed.

### Confirmed non-security robustness issue

A current-version truncated persistence payload whose latest month is
`0000-01` reaches `previousCalendarMonth()` and raises the deliberate
`RangeError` (`packages/core/src/analysis/context.ts:96-114`;
`apps/web/src/lib/analysis-result.ts:922-981`;
`apps/web/src/lib/persistence.ts:822-915`). The store catches unexpected
restore exceptions, removes the payload, and shows an access error
(`apps/web/src/lib/store.svelte.ts:117-148`).

This is a Low reliability/data-restoration regression with High confidence,
not a retained security finding. A hostile website cannot write this
origin-scoped `sessionStorage`; code already executing on the application
origin can cause denial or data deletion more directly. The root fix belongs
in the coherence/deserialization validator: treat the lower-bound predecessor
as a false validation result, and add a no-throw malformed-snapshot regression.

### Likely and manual-risk observations

No likely security finding survived source tracing. Existing manual-risk items
remain historical rather than Cycle 19 novelties: plaintext per-tab financial
state, static-host CSP constraints, third-party issuer links, remote-model
consent, and the operational reachability of upstream dependencies. No
authentication or authorization control is applicable to this static,
account-free application.

## Verification and missed-issue sweep

- 77 focused Cycle 18 tests passed with 185 expectations.
- Core TypeScript and web Astro checks passed; web reported zero errors,
  warnings, or hints.
- `dependencies:check`, `data:check`, and documentation drift checks passed.
- `git diff --check` passed; all six Cycle 18 commits have good signatures and
  local/remote branch parity is exact.
- The closing pass rechecked secrets, executable interpretation, dynamic HTML,
  filesystem/process calls, network and redirect paths, storage parsing,
  worker messages, resource bounds, workflow authority, generated identity,
  and the changed exception paths.

The six protected untracked Cycle 42 paths were excluded from review edits and
remain outside the tracked baseline. No deployment was performed.
