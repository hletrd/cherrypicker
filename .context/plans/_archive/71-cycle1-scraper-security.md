# Plan 71 — Cycle 1 Scraper and Web Security Boundaries

**Archived:** 2026-07-23 after recorded implementation and verification
**Date:** 2026-07-23
**Source:** `.context/reviews/_aggregate.md` C1-035 through C1-039; raw findings SR-01 through SR-04, TR-06, and TE-08
**Status:** IMPLEMENTED AND VERIFIED — all five boundaries, publication fixtures, documentation, and focused browser regressions pass
**Deployment:** None. This plan must not deploy or push to `main`.

## Scope and non-negotiable invariants

All five findings are security or correctness work and are scheduled below. None is deferred.

1. Remote HTML and LLM output are untrusted. They may supply card facts, but they may not choose an issuer directory, an output filename outside the local naming policy, or whether an existing file is replaced.
2. A catalog URL is either absent or an unchanged, absolute HTTP(S) URL. Invalid input must fail publication and must also be omitted at the rendering boundary.
3. The current GitHub Pages origin cannot emit custom response headers. The implementation must remove false header claims and provide a functional, fail-closed client-side frame fallback while documenting that it is weaker than a response `frame-ancestors` policy.
4. Every outbound scraper request, including every redirect, must pass scheme, host, DNS/IP, status, content-type, timeout, and response-size checks.
5. Both Sonnet 5 call sites must use an explicit deterministic thinking/output contract. Tests must inspect the production request builders without making live Anthropic calls.
6. Preserve all pre-existing dirty work. Implementation commits must contain only intentional changes for these tasks.

## Task 1 — Make scraper filesystem coordinates local policy [C1-035]

**Severity / confidence:** High / High
**Current regions:** `packages/rules/src/schema.ts:41-57`, `tools/scraper/src/prompts/schemas.ts:8-31`, `tools/scraper/src/validators.ts:14-103`, `tools/scraper/src/extractor.ts:17-61`, `tools/scraper/src/writer.ts:10-46`, `tools/scraper/src/cli.ts:19-50,73-121`, `tools/cli/src/commands/scrape.ts:9-70`

### Contract

- Export a canonical `cardIdSchema`/`CARD_ID_PATTERN` from `@cherrypicker/rules`.
  - Length: 1 through 100 characters.
  - Pattern: `^[a-z0-9]+(?:[.-][a-z0-9]+)*$`.
  - This accepts the eight current dotted product IDs such as `hana-wonder-2.0` while rejecting `/`, `\`, leading/trailing separators, `.`/`..` path segments, whitespace, controls, percent escapes, and absolute paths.
- Use that schema in `cardMetaSchema` and mirror its `pattern`, `minLength`, and `maxLength` in `CARD_RULE_EXTRACTION_TOOL`.
- Define one `SCRAPER_ISSUERS` tuple for the ten target files (`hyundai`, `kb`, `samsung`, `shinhan`, `lotte`, `hana`, `woori`, `ibk`, `nh`, `bc`) and derive the CLI/runtime allowlist from it. Do not maintain separate string lists in help text, target loading, and validation.
- Parse and reject an unsupported issuer before constructing the target JSON path. After loading, require `target.issuer === expectedIssuer`.
- Change `validateExtractedRules` to take `expectedIssuer`; reject unless the canonical parse succeeds and `parsed.card.issuer === expectedIssuer`.
- Change the writer API to receive local coordinates separately, for example:

  ```ts
  writeCardRule(rule, {
    outputDir,
    expectedIssuer,
    overwrite: false,
  })
  ```

  The directory must come from `expectedIssuer`, never from `rule.card.issuer`. Assert equality again at this final boundary.
- Make no-overwrite the default. Add an explicit `--force` flag to both scraper CLI entry points, document it in help, and forward it through `tools/cli`; no other condition may enable replacement.

### Containment and write algorithm

1. Create the requested output root if needed, then canonicalize it with `realpath`.
2. Resolve the allowlisted issuer directory beneath that real root. Reject an existing issuer directory if `lstat` says it is a symlink; after creation, canonicalize it and verify `relative(rootReal, issuerReal)` is neither absolute nor `..`/`../...`.
3. Resolve `${validatedCardId}.yaml` beneath the canonical issuer directory and repeat the root-relative containment check.
4. Reject an existing destination symlink even with `--force`.
5. Without `--force`, open atomically with exclusive-create semantics (`wx` or `O_CREAT | O_EXCL`) so concurrent runs cannot both pass a check-then-write sequence.
6. With `--force`, replace only a regular file at the contained destination. Use no-follow semantics where the runtime exposes them and never follow a final-component symlink.
7. Serialize only after all coordinate checks pass, and close the file handle in `finally`.

Lexical `resolve()` alone is insufficient because an issuer directory may already be a symlink. The real-path and `lstat` checks are part of the acceptance contract.

### Exact tests

- Extend `packages/rules/__tests__/schema.test.ts`:
  - accept ordinary hyphenated IDs and all current dotted-ID shapes;
  - reject `../x`, `foo/../../x`, `foo\..\x`, `/tmp/x`, `C:\x`, `.`, `..`, leading/trailing separators, uppercase, spaces, NUL/control characters, and values longer than 100 characters;
  - keep a full-corpus assertion proving every checked-in card ID passes the new schema.
- Add `tools/scraper/__tests__/validators.test.ts`:
  - accept a canonical rule whose issuer equals the expected allowlisted issuer;
  - reject a valid but different issuer and every unsupported issuer before returning a `CardRuleSet`;
  - prove a traversal ID is rejected by the real canonical validator.
- Add `tools/scraper/__tests__/writer.test.ts` using a fresh `mkdtemp` root per test:
  - write a valid file under `<real-root>/<expectedIssuer>/<cardId>.yaml`;
  - reject traversal and issuer mismatch even when the test deliberately bypasses TypeScript with a cast;
  - reject an issuer-directory symlink and a destination-file symlink without modifying the target;
  - preserve an existing regular file by default;
  - replace that regular file only with `overwrite: true`;
  - start two default writes for the same path and assert exactly one succeeds.
- Refactor argument parsing into importable pure functions and test in `tools/scraper/__tests__/args.test.ts` and `tools/cli/__tests__/commands.test.ts` that unsupported issuers fail before file access and that `--force` is false by default and forwarded only when present.

### Acceptance criteria

- No model-controlled value is used as a directory coordinate.
- Validation fails before `mkdir`, serialization, or file open for an invalid ID or issuer.
- An attempted escape or symlink write leaves every path outside the temporary output root byte-for-byte unchanged.
- A normal second scrape refuses to overwrite the first result and prints an actionable `--force` instruction.

## Task 2 — Enforce safe catalog URLs at publication and click time [C1-036]

**Severity / confidence:** Medium / High
**Current regions:** `packages/rules/src/schema.ts:41-57`, `scripts/build-json.ts:18-81,224-245,381-428`, `apps/web/src/lib/cards.ts:135-157,237-309`, `apps/web/src/components/cards/CardDetail.svelte:172-186`

### Shared URL contract

- Add and export a pure `safeExternalUrl` predicate/parser and a Zod schema from `@cherrypicker/rules`.
- Preserve the existing absent-value contract: `undefined` and `""` mean “no official link.”
- A non-empty value is valid only when:
  - it is unchanged by `trim()` and contains no C0/DEL control character;
  - `new URL(value)` succeeds without a base URL, making protocol-relative values invalid;
  - the protocol is exactly `http:` or `https:`;
  - username and password are empty.
- Use this schema in canonical `cardMetaSchema`.
- Import the same URL schema into the publication schema used by `scripts/build-json.ts`; remove its independent `z.string()` URL rule. The rest of the generator-schema consolidation belongs to C1-065, but the URL contract must not remain duplicated.
- Add `@cherrypicker/rules` as a declared web runtime dependency if the browser imports the shared helper; do not rely on workspace hoisting.

### Rendering guard

- In `CardDetail.svelte`, derive a guarded URL from `card.url` immediately before rendering.
- Render “공식 카드 페이지” only when the guard returns a safe URL, and bind `href` to that guarded value rather than the raw catalog field.
- Keep `target="_blank"` with `rel="noopener noreferrer"`.
- Do not silently turn an invalid value into a relative URL or `#`.

The component guard remains required as defense in depth even though `cards.ts` now validates fetched detail shards with the canonical runtime schema.

### Exact tests

- Extend `packages/rules/__tests__/schema.test.ts` with accepted `http://` and `https://` URLs, query/fragment cases, and absent/empty values.
- In the same suite, reject `javascript:`, mixed-case JavaScript schemes, `data:`, `file:`, `blob:`, `//example.com`, relative paths, credentials, leading/trailing whitespace, embedded newline/tab/NUL, and malformed URLs.
- Add `scripts/__tests__/catalog-publication.test.ts` against the production publication parser. A minimal card with `javascript:` or `data:` must produce a build validation error and no publishable card; a valid HTTPS or empty URL must pass.
- Add `apps/web/__tests__/external-url.test.ts` against the production helper, not a copied implementation.
- Add E2E cases to `e2e/security-regressions.spec.js` that derive a one-card fixture from the current `cards-summary.json` plus issuer detail shard, intercept those split artifacts with malicious URLs, open the card, and assert there is no “공식 카드 페이지” anchor and no element whose `href` begins with `javascript:` or `data:`. A valid HTTPS fixture must still render the anchor with `noopener noreferrer`.

### Acceptance criteria

- An unsafe URL cannot enter newly generated public JSON.
- A malicious or stale public JSON payload still cannot create a clickable unsafe link.
- The current 683-card corpus (480 HTTP(S), 203 empty, 0 unsafe) passes without weakening the rule.

## Task 3 — Replace ineffective clickjacking meta claims with a static-host fallback [C1-037]

**Severity / confidence:** Medium / High
**Current regions:** `apps/web/src/layouts/Layout.astro:37-56`, `apps/web/public/scripts/layout.js:1-105`, `.github/workflows/deploy.yml:37-55`, `README.md:38,80,90`

### Implementation

- Remove `frame-ancestors 'none'` from the meta-delivered CSP because browsers ignore that directive in a meta policy.
- Remove the `X-Frame-Options` and `X-Content-Type-Options` `http-equiv` tags. They are response headers, and their presence in HTML must not be presented or tested as enforcement.
- Keep the valid referrer meta policy.
- Add a small same-origin `apps/web/public/scripts/frame-guard.js`, loaded synchronously at the start of `<head>`:
  1. The initial `<html>` class and a minimal head style hide the body and disable pointer events until the guard runs.
  2. When `window.top === window.self`, remove the guard class immediately so normal top-level rendering proceeds.
  3. When framed, leave the application hidden/non-interactive and attempt a top-level escape. Catch cross-origin navigation errors without revealing the application.
  4. Include a `<noscript>` override so the static informational shell is not blank when JavaScript is disabled. Document that this no-script behavior is a residual limitation; the interactive financial workflow already requires JavaScript.
- Add a concise security/deployment note to `README.md`:
  - GitHub Pages does not provide repository-configurable custom response headers;
  - the frame guard is client-side defense in depth, not equivalent to response `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options: DENY`;
  - a future host/CDN must emit real CSP, `X-Content-Type-Options`, HSTS, and the chosen referrer policy before the fallback can be described as header-enforced.

This closes the current finding through its “functional client fallback” branch. It must not claim that GitHub Pages now emits security headers, and it does not authorize a host migration or deployment in this cycle.

### Exact tests

- Add `apps/web/__tests__/frame-guard.test.ts` that executes the production `frame-guard.js` in a controlled VM context:
  - top-level context removes the pending class;
  - framed context never removes it;
  - a thrown cross-origin top-navigation error is caught and leaves the document blocked.
- Extend `e2e/security-regressions.spec.js`:
  - top-level navigation exposes the page and keeps primary navigation usable;
  - an attacker document embeds the app cross-origin and the result is either a successful top-level escape or a hidden, pointer-inert frame with no focusable application control.
- Add a rendered-layout assertion that the ineffective meta tags and meta `frame-ancestors` directive are absent. Do not replace this with a test that merely searches for new security-looking markup.

### Acceptance criteria

- The application remains usable at top level with JavaScript enabled.
- A framed JavaScript-enabled copy cannot expose or receive clicks on upload/dashboard controls.
- Documentation and tests accurately state that response headers are still unavailable on the static host.

## Task 4 — Add a fail-closed scraper network policy and bounded reader [C1-038]

**Severity / confidence:** Medium / High
**Current regions:** `tools/scraper/src/cli.ts:19-37,88-104`, `tools/cli/src/commands/scrape.ts:18-26,40-64`, `tools/scraper/src/fetcher.ts:3-66`, `tools/scraper/__tests__/fetcher.test.ts:1-28`, `.context/plans/00-deferred-items.md:1894-1900`

### URL, host, and address policy

- Add a testable network-policy module used before every network call.
- Parse with `new URL` and permit only `http:` and `https:`. Reject credentials and malformed hosts.
- Add `allowedHosts` to issuer target policy. The configured `baseUrl` hostname is allowed by default; every additional legitimate redirect hostname must be explicit.
- A `--url` override remains constrained to that issuer's host policy. Add repeatable `--allow-host <exact-host>` to both CLI layers for an intentional host expansion. It must print a warning and must not disable scheme, DNS/IP, redirect, timeout, status, content-type, or byte-limit checks.
- Normalize hostnames consistently (ASCII form, lowercase, no trailing dot) and use exact-host matching. Do not treat string suffixes such as `evil-kbcard.com` as subdomains.
- Immediately before each request, resolve all A/AAAA answers with `node:dns/promises`. Reject the request if resolution fails, returns no addresses, or any answer is non-public.
- Pin the actual connection lookup to the just-validated public answer set and verify the connected socket address is a member of that set. Preserve the original hostname for the HTTP `Host` header, TLS SNI, and certificate verification. A preflight `dns.lookup()` followed by an independently resolving global `fetch()` is not acceptable because a rebinding answer could change between validation and connection.
- Treat at least the following as non-public:
  - IPv4 unspecified, loopback, private, link-local/metadata, carrier-grade NAT, documentation/benchmark ranges, multicast, and reserved space;
  - IPv6 unspecified, loopback, unique-local, link-local, documentation, multicast, and IPv4-mapped forms of blocked IPv4 addresses.
- Validate literal IP hosts with the same rules. Apply the complete policy again to every redirect target.

### Redirect, response, size, and cleanup policy

- Use `redirect: "manual"` and follow only 301, 302, 303, 307, and 308, with a hard maximum of five hops.
- Resolve relative `Location` values against the current URL, then re-run the complete URL/host/address policy before issuing the next request. Reject a missing location, redirect loop, disallowed host, or private-address target.
- Cancel/drain each redirect response body before continuing so its connection is not leaked.
- Use one 30-second operation deadline and clear its timer in `finally` on success, HTTP failure, DNS failure, fetch rejection, stream rejection, abort, and redirect rejection.
- Require a successful final status before reading content.
- Require an HTML media type (`text/html` or `application/xhtml+xml`); reject missing or unrelated content types.
- Set `MAX_RESPONSE_BYTES = 5 * 1024 * 1024`.
  - Reject a numeric `Content-Length` above the cap before reading.
  - Read `response.body` incrementally, count actual bytes, cancel the reader, and throw as soon as the cap is crossed.
  - Never call unbounded `response.text()` or `response.arrayBuffer()`.
- Buffer the bounded bytes once. Detect UTF-8/EUC-KR/CP949 aliases from the checked response header and the bounded HTML head, then decode the same bytes. Delete the second encoding fetch entirely; it cannot have a separate unchecked status or leaked timer if it does not exist.
- Error messages may include the normalized public URL and hop count, but must not echo credentials.
- Once this lands, update `.context/plans/00-deferred-items.md` entry `C32-SEC-SSRF` to “resolved by C1-038” and remove its false hostname-whitelist rationale.

### Exact tests

- Add `tools/scraper/__tests__/network-policy.test.ts` with an injected resolver:
  - reject `file:`, `ftp:`, credentials, malformed hosts, raw loopback/private/link-local/metadata IPv4, `::1`, `fc00::`, `fe80::`, and IPv4-mapped loopback/private IPv6;
  - reject a hostname whose answer set mixes public and private addresses;
  - simulate a public preflight answer followed by a private transport address and prove the socket is rejected, covering the DNS-rebinding check;
  - accept representative public IPv4 and IPv6 answers;
  - require exact allowlist matches and reject suffix-confusion/trailing-dot tricks.
- Expand `tools/scraper/__tests__/fetcher.test.ts` with injected fetch/resolver/timer seams:
  - first-hop and redirect policy rejection occurs before the forbidden fetch;
  - relative allowed redirects work, while loops and a sixth hop fail;
  - non-2xx final responses and missing/wrong content types fail before body processing;
  - oversized `Content-Length` and chunked bodies crossing the cap fail and cancel the reader;
  - UTF-8, `euc-kr`, `ks_c_5601-1987`, and CP949 header/meta cases decode from one fetch;
  - fetch rejection, stream rejection, explicit abort, and every thrown branch clear the timeout in `finally`;
  - assertions count calls and prove the legacy meta-charset path no longer re-fetches.
- Extend CLI tests for configured-host defaulting, rejected off-policy `--url`, repeatable `--allow-host` forwarding, and the fact that `--allow-host` cannot authorize a private resolved address.
- Tests must use mocked responses/resolution; they must not contact live issuer sites or local cloud-metadata endpoints.

### Acceptance criteria

- No network request occurs until its exact target has passed protocol, host, and resolved-address policy.
- A redirect cannot broaden authority granted to the original URL.
- At most 5 MiB is retained, regardless of `Content-Length`.
- Encoding detection performs exactly one body fetch.
- The operation leaves no timer, reader, or response body active on any exit path.

## Task 5 — Make both Sonnet 5 output budgets explicit [C1-039]

**Severity / confidence:** High / High
**Current regions:** `tools/scraper/src/extractor.ts:33-40`, `packages/parser/src/pdf/llm-fallback.ts:74-104`

The installed `@anthropic-ai/sdk` types already include `ThinkingConfigDisabled`; no dependency upgrade or network documentation lookup is required for this change.

### Deterministic request contract

- At both call sites set:

  ```ts
  thinking: { type: 'disabled' },
  max_tokens: 8_192,
  ```

- Keep `ANTHROPIC_MODEL` override support and the current `claude-sonnet-5` default.
- Give each module a named output-budget constant and type its request builder with the SDK's non-streaming message-create type. The pure builders must be importable by tests so request-shape coverage never calls Anthropic.
- Document why thinking is disabled: these calls need complete machine-readable tool/JSON output, and an implicit/adaptive thinking allocation must not consume the output ceiling.
- Before parsing content, reject `stop_reason === "max_tokens"` with a specific truncation error. Do not pass a partial tool input or partial JSON array into ordinary schema/JSON errors.
- Keep the scraper's tool-use requirement and PDF structural validation unchanged after this new stop-reason guard.

### Exact tests

- Add `tools/scraper/__tests__/extractor.test.ts`:
  - production request builder uses the selected/default model, `thinking: { type: "disabled" }`, and `max_tokens: 8192`;
  - a mocked `max_tokens` stop reason throws the dedicated truncation error before tool validation;
  - a complete tool response still follows canonical validation, including expected-issuer matching from Task 1.
- Expand `packages/parser/__tests__/llm-fallback.test.ts`:
  - test the production PDF request builder for the same thinking and output ceiling;
  - use an injected/mock client rather than the current “well-formed key makes a real failed API call” test;
  - assert `max_tokens` stop reason becomes the dedicated truncation error;
  - assert a complete JSON response still reaches the existing structural filters.
- Add a source-wide assertion or focused `rg` gate that the two production `claude-sonnet-5` call sites both include explicit `thinking`; do not rely on this textual check instead of request-builder tests.

### Acceptance criteria

- Both Sonnet 5 requests expose the same deliberate thinking/output contract in runtime request objects.
- All 8,192 tokens are available to structured output rather than an implicit thinking budget.
- Truncated responses are distinguishable from malformed model output.
- No test uses a real API key or makes a live Anthropic request.

## Implementation order and integration points

1. Land the shared card-ID, issuer, and URL primitives with canonical-schema tests.
2. Apply expected-issuer validation and the contained/no-overwrite writer contract.
3. Apply publication/runtime URL guards.
4. Implement the network policy and single bounded-byte fetch path, then wire both CLIs.
5. Apply the two Sonnet request contracts and their pure request-builder tests.
6. Replace the ineffective frame markup with the static-host fallback and run its unit/E2E checks.
7. Regenerate catalog artifacts only through the normal generator, review the generated diff, and update the stale SSRF deferral entry as resolved.

Where Task 2 meets the broader C1-065 publication-schema work, there must be one canonical URL validator and one build regression fixture. Do not keep two implementations merely to avoid coordinating the plans.

## Verification gates

### Focused non-browser gates

```sh
bun test \
  packages/rules/__tests__/schema.test.ts \
  packages/rules/__tests__/security.test.ts \
  tools/scraper/__tests__/validators.test.ts \
  tools/scraper/__tests__/writer.test.ts \
  tools/scraper/__tests__/args.test.ts \
  tools/scraper/__tests__/schema-contract.test.ts \
  tools/scraper/__tests__/network-policy.test.ts \
  tools/scraper/__tests__/fetcher.test.ts \
  tools/scraper/__tests__/extractor.test.ts \
  tools/cli/__tests__/commands.test.ts \
  tools/cli/__tests__/disclosures.test.ts \
  packages/parser/__tests__/llm-fallback.test.ts \
  scripts/__tests__/catalog-publication.test.ts \
  apps/web/__tests__/external-url.test.ts \
  apps/web/__tests__/frame-guard.test.ts
```

After generation, audit that every non-empty card URL is absolute HTTP(S), review all generated-file diffs, and confirm the generator reports no security-validation warning as success.

### Whole-repository gates

```sh
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

No warning suppression, skipped security test, live Anthropic call, or live issuer-network dependency is acceptable.

### Browser/E2E lifecycle

- Run browser gates through the repository-owned E2E lifecycle. It cleans only strict ownership records, chooses port 4173 when free or a freshly verified loopback alternate, and propagates that exact port and base URL to Playwright.
- After every pass, failure, `INT`, or `TERM`, close the owned Playwright/preview process group and verify the recorded port is clear. A foreign listener on 4173 is never kill authority and does not make repository-owned status unclean.
- Never use a blanket `pkill` against Chrome/Chromium. Preserve the user's interactive Chrome processes and the unrelated Travelback browser/session.
- If a focused test, whole-repository gate, or E2E run fails, record the exact failure and clean up, but do not stop the outer review-plan-fix loop; the next cycle must still run. A failed security acceptance criterion remains open in this plan until a later cycle fixes it.

## Completion checklist

### Implementation progress — 2026-07-23

- C1-035 is implemented. Canonical ID and issuer policy, expected-issuer validation, contained real-path writes, symlink rejection, atomic no-overwrite behavior, explicit `--force`, and both CLI forwarding layers have focused regression coverage.
- C1-036 is integrated through the browser rendering boundary. The canonical rules schema and production publication boundary use the shared URL validator, malicious publication fixtures are rejected, both safe fixtures carry the current reward metadata, and `CardDetail.svelte` renders the official-page anchor only from `safeExternalHref`. Three split summary/detail browser regressions prove `javascript:` and `data:` suppression plus safe HTTPS `rel`/`target` behavior.
- C1-037 has a tested production `public/scripts/frame-guard.js` asset, layout integration, and the exact README static-host/no-JavaScript limitations. `Layout.astro` starts hidden and pointer-inert, loads the guard synchronously, supplies the documented `<noscript>` override, and no longer claims ineffective frame/content-type response headers through meta elements. The rendered regressions prove top-level reveal/meta absence and route an attacker page at a distinct loopback origin to a response that executes the exact production `frame-guard.js`; the framed app remains hidden and pointer-inert.
- C1-038 is implemented. Initial targets and redirects use exact normalized host policy, public-only DNS answers, pinned lookup/socket verification, one operation deadline, manual bounded redirects, response/media checks, a 5 MiB streamed cap, and one-buffer charset decoding. The stale deferred entry is closed.
- C1-039 is implemented at both Sonnet call sites with importable typed request builders, disabled thinking, an 8,192-token output budget, pre-parse truncation errors, and no-live-API tests. The scraper extraction schema and system prompt also use the canonical 0–100 percentage-point rate contract.
- The C1-011 follow-up now derives scraper categories, subcategories, supported condition fields/values, and the reward input schema from the shared rules taxonomy and Zod schema. Extracted output receives canonical Zod and semantic catalog validation; stale categories, `excludeOnline`, invalid category pairs, and missing rule metadata have focused regression coverage.
- CI no longer auto-consents to remote LLM transfer. Only explicit `--allow-remote-llm --yes` bypasses the prompt, while local parsing still runs before consent is considered. CLI optimize/report output now discloses the assumed or user-supplied previous-spending basis and summarizes `unsupportedRules`.
- The reconciled focused security run has 158 passing tests and 0 failures. Rules, scraper, CLI, and web typechecks pass; `node --check` passes for the security spec.
- All five security browser cases passed as part of the final 81/81 blocking E2E run. The repository-owned wrapper left port 4173 available with no owned Playwright, preview, Chrome/Chromium, profile, or run record. Concurrent Travelback browser processes were traced to their separate checkout and deliberately preserved.
- The final forced Bun 1.2.6 whole-repository `verify`, 1,639 Bun tests, and 2,151 Vitest tests passed. No deployment or live issuer/Anthropic request was performed.

- [x] Task 1 filesystem coordinate and no-overwrite contract implemented and tested.
- [x] Task 2 publication and rendering URL contract implemented; safe fixtures and split-artifact browser regressions pass.
- [x] Task 3 functional static-host frame fallback implemented, unit-tested, accurately documented, and browser-verified.
- [x] Task 4 per-hop network policy, bounded reader, and cleanup implemented and tested.
- [x] Task 5 explicit thinking/output contract implemented at both Sonnet 5 call sites and tested.
- [x] Stale `C32-SEC-SSRF` deferred entry marked resolved.
- [x] Focused non-browser gates pass.
- [x] Whole-repository non-deploy gates pass under pinned Bun 1.2.6.
- [x] The five new security E2E cases pass under repository-owned cleanup.
- [x] No deployment performed.

## Aggregate ID coverage

| Aggregate ID | Scheduled task | Regression proof | Disposition |
|---|---|---|---|
| C1-035 | Task 1 | Canonical ID/issuer tests plus real temp-root validator/writer, symlink, exclusive-create, and force tests | Implemented and unit-tested |
| C1-036 | Task 2 | Canonical schema, publication fixture, production helper, and intercepted split-catalog E2E tests | Implemented and browser-verified |
| C1-037 | Task 3 | Production frame-script VM tests, rendered-layout assertion, and cross-origin frame E2E | Functional static-host fallback implemented and browser-verified |
| C1-038 | Task 4 | Resolver/IP, redirect, status/type, byte-cap, charset, abort, and timer/finally tests | Implemented and unit-tested; stale prior deferral resolved |
| C1-039 | Task 5 | Production request-builder and truncation tests for scraper and PDF fallback | Implemented and unit-tested at both call sites |

## Implementation diff check

- [x] `git diff --check -- .context/plans/71-cycle1-scraper-security.md` passed. Because the file is new/untracked, `git diff --no-index --check /dev/null .context/plans/71-cycle1-scraper-security.md` also checked its actual contents.
- [x] A path-scoped `git diff --check` passed for this lane's rules, scraper, CLI, web security helper, test, and plan changes. Untracked files were also checked with `git diff --no-index --check`.
- [x] Final diff and gate audit completed without deployment; only the non-main review branch is eligible for the later scoped push.
