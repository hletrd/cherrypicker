# Review-plan-fix Cycle 20 — security reviewer

## Review identity

- Date: 2026-07-24
- Reviewed revision: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: defensive trust boundaries, untrusted input, storage, network,
  rendering, filesystem, supply chain, and CI authority
- Scope: whole tracked repository and documentation; Cycle 18/19 work is
  resolved provenance unless a distinct current root exists
- Review mode: read-only except for this report; no browser, E2E, source,
  generated-data, plan, Git-history, network publication, or deployment change

## Complete inventory and trust-boundary coverage

Inventory preceded review. All 2,424 tracked paths were classified: 1,252
context/history paths, 683 authored card YAML files, 30 generated/public
artifacts, 181 test/E2E paths, 211 production-source paths, 29 documentation
paths, 21 manifest/config/workflow paths, one fixture, and 16 other assets.

The defensive traces covered:

1. browser file admission, bounded parsing workers, typed transaction facts,
   optimizer messages, result coherence, same-origin persistence, framework
   rendering, external links, and frame guard;
2. CLI file admission, local-first parsing, explicit remote-model consent,
   terminal output, standalone report escaping, and race-resistant report
   writes;
3. scraper URL/host admission, DNS/public-address validation, pinned
   connection identity, redirect revalidation, bounded response, untrusted
   page quarantine, schema validation, and no-follow durable writes;
4. card YAML, schema/semantic validation, model-authored source quarantine,
   publication identity, generated split artifacts, and browser readers;
5. manifests, lock/vendor integrity, dependency ownership, scripts, process
   boundaries, and CI event/job permissions.

All tracked documentation and historical security owners entered the novelty
sweep. The six protected untracked Cycle 42 files were not opened, searched,
or modified.

## Result

No genuinely new Cycle 20 security root survived review.

| Classification | Count | Severity | Confidence | Exploit/failure scenario | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| Confirmed new | 0 | Not applicable | High for inspected trust boundaries | None | None |
| Likely new | 0 | Not applicable | Medium-high whole-tree negative confidence | None | None |
| Manual-validation-only new | 0 | Not applicable | Medium-high | None | None |

## Confirmed current controls

- Persistence rejects prototype-affecting keys, requires plain objects,
  validates the accepted graph, reconciles domain facts, and fails closed on
  final coherence exceptions
  (`apps/web/src/lib/persistence.ts:68-125,720-925`).
- The only Svelte raw-HTML sink selects markup from a repository-owned static
  icon table; caller input is only a lookup key
  (`apps/web/src/components/ui/Icon.svelte:1-60`). Dynamic report content is
  escaped and template placeholders are exact-once
  (`packages/viz/src/report/generator.ts:24-118,143-210`); terminal control and
  bidi sequences are removed (`packages/viz/src/terminal/sanitize.ts:1-20`).
- Card IDs are path-safe slugs and external links require absolute HTTP(S),
  no credentials, padding, or controls. Model-authored cards cannot publish a
  source URL before review
  (`packages/rules/src/security.ts:18-56`;
  `packages/rules/src/schema.ts:262-285,323-331`).
- Scraper targets require an exact allowlisted host
  (`tools/scraper/src/network-policy.ts:198-275`); each hop resolves and pins
  public addresses, asserts the connected socket address, revalidates
  redirects, and bounds time and bytes
  (`tools/scraper/src/fetcher.ts:125-199,220-285`).
- Scraper model input/output is bounded, page content is encoded inside an
  explicit untrusted-data envelope, model URLs are removed, and rewards remain
  unsupported pending human source review
  (`tools/scraper/src/extractor.ts:10-53,71-174`).
- Remote PDF fallback requires the allow flag plus interactive or explicit CI
  confirmation (`tools/cli/src/consent.ts:14-82`). Report output rejects
  symlinks/untrusted directory chains and uses exclusive or atomic durable
  writes (`tools/cli/src/report-output.ts:35-120,187-280`).
- CI has empty top-level permissions, pinned actions, disabled persisted
  checkout credentials, frozen install, and deploy authority only in the
  separately scoped main/manual Pages path
  (`.github/workflows/deploy.yml:1-79`).
- `bun audit --json` returned an empty advisory object, and the dependency,
  peer, direct-import, remote-reference, and vendor-integrity gate passed.

## Cycle 19 closure and candidate disposition

The former `0000-01` coherence exception is closed
(`apps/web/src/lib/analysis-result.ts:893-924`;
`apps/web/src/lib/persistence.ts:905-925`). It was a Low reliability issue,
not a privilege or confidentiality boundary: a same-origin writer capable of
tampering with session storage can already delete that tab's state. It remains
resolved Cycle 19 provenance.

| Candidate and exact region | Concrete exploit/failure considered | Disposition / existing fix or exit action |
| --- | --- | --- |
| Publication hash semantics — `apps/web/src/lib/catalog-publication-identity.ts:1-23`; `apps/web/src/lib/cards.ts:131-141` | An attacker controlling the same static origin replaces both payload and advertised hash | **Rejected as a new vulnerability.** The hash is a cross-artifact coherence identity, not a remote signature; same-origin compromise already controls application code. Keep schema/HTTPS hosting controls; use signed artifacts only if the threat model adds an independent distribution verifier. |
| Plaintext analysis state — `apps/web/src/lib/store.svelte.ts:60-73` | Same-origin script or a privileged extension reads per-tab financial data | **Confirmed historical, non-new:** C33-F4/C32-SEC-STORE. The limitation is documented and origin/tab scoped. Revisit with user-held key management or no persistence if the threat model changes. |
| Static-host CSP — `apps/web/src/layouts/Layout.astro:54-66`; `README.md:141` | A script-injection primitive gains impact because meta CSP still permits required inline code and cannot supply response-only `frame-ancestors` | **Confirmed historical, non-new:** D7-M13/D-C10-04/C34-D01. No new injection primitive was found. Move to nonce-capable response headers when hosting permits it. |
| Raw icon HTML — `apps/web/src/components/ui/Icon.svelte:1-60` | An untrusted icon name injects arbitrary markup | **Rejected.** Names index a closed module-level constant; no external markup is concatenated. No fix indicated. |
| Scraper SSRF/DNS rebinding — `tools/scraper/src/network-policy.ts:198-275`; `tools/scraper/src/fetcher.ts:125-285` | Allowed hostname resolves privately or redirects/rebinds after validation | **Rejected.** Mixed/private results are refused, DNS is pinned, actual remote address is asserted, and every redirect is revalidated. Preserve focused tests. |
| Remote-model prompt/source poisoning — `tools/scraper/src/extractor.ts:10-174`; `packages/rules/src/schema.ts:262-285` | Issuer HTML instructs the model to publish executable/source-controlled fields | **Rejected.** Content is data-encoded, output is schema-validated, URLs are deleted, and rewards are quarantined pending review. |

No authentication or authorization control is applicable to the account-free
static web application. No new credential exposure, executable
interpretation, origin crossing, path traversal, SSRF, XSS, prototype
pollution, workflow escalation, or supply-chain root survived tracing.

## Read-only verification

- `bun run toolchain:check`: Bun 1.3.12 passed.
- `bun run dependencies:check`: manifest/import/peer/vendor policy passed.
- `bun audit --json`: `{}`.
- `bun run data:check`: 683 cards across 24 issuers and every generated/docs
  projection matched canonical output.
- `bun run lint` and `bun run typecheck`: every workspace passed; Astro
  reported zero errors, warnings, and hints.
- Eight focused persistence, worker-protocol, rule-security, and scraper
  network suites: 319 tests passed, 0 failed, with 1,076 expectations.
- `bun scripts/check-web-bundles.ts`: all initial graph and publication-size
  budgets passed.
- `git diff --check` from Cycle 17 closure through reviewed HEAD: passed.

## Final missed-issue sweep

The closing pass rechecked credential markers, dynamic code and markup,
external URLs, JSON and worker messages, archive/resource bounds, storage
admission and cleanup, terminal/report escaping, filesystem races, DNS and
redirects, model quarantine, generated-artifact identity, dependencies,
workflow authority, process commands, and every historical security owner.
No confirmed, likely, or manual-validation-only new security issue survived.

No browser process was started or terminated by this reviewer. No deployment
or publication command was invoked.

Final new security finding count: **0**.
