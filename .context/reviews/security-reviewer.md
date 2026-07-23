# Security Reviewer — Current-State Review

**Reviewer:** security-reviewer
**Date:** 2026-07-23
**Baseline:** working tree based on `e6fe49b` (including pre-existing local edits)
**Scope:** browser trust boundaries, generated catalog data, scraper/CLI network and filesystem boundaries, XSS, clickjacking, secrets, and resource exhaustion

## Summary

| ID | Severity | Confidence | Status | Finding |
|---|---|---|---|---|
| SR-01 | High | High | Confirmed | LLM-controlled card metadata can escape the scraper output directory and overwrite arbitrary writable files |
| SR-02 | Medium | High | Confirmed dormant path | Unvalidated catalog URLs reach a clickable `href`, allowing a stored `javascript:` URL |
| SR-03 | Medium | High | Confirmed | The apparent clickjacking headers are meta tags that browsers do not enforce as response headers |
| SR-04 | Medium | High | Confirmed / known-deferred | Scraper URL overrides permit SSRF and unbounded response buffering |

No critical finding was identified. The current 683-card corpus contains no active non-HTTP(S) URL, but the data-generation boundary still accepts one.

## SR-01 — LLM output controls a filesystem path outside the scraper output root

**Severity:** High
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `tools/scraper/src/extractor.ts:23-31,52-61`
- `tools/scraper/src/prompts/schemas.ts:8-16`
- `tools/scraper/src/validators.ts:14-30`
- `packages/rules/src/schema.ts:41-57`
- `tools/scraper/src/writer.ts:10-17,44`

**Evidence:** Remote page text is embedded directly into the LLM message. The returned tool input is accepted by `cardRuleSetSchema`, where `card.id` and `card.issuer` are unrestricted `z.string()` values. The tool schema describes `id` as lower-case/hyphenated but supplies no pattern, and the runtime schema does not require the returned issuer to equal the CLI-selected issuer. `writeCardRule()` then constructs:

```text
join(outputDir, rule.card.issuer, `${rule.card.id}.yaml`)
```

without resolving the destination and checking containment. A read-only probe using `card.id = "../../../../.github/workflows/pwn"` showed `cardRuleSetSchema.safeParse()` succeeds and the normalized path is outside the card root.

**Exploit scenario:** An issuer page, redirected page, or page fragment contains prompt-injection text telling the model to return a traversal string as the card ID. A developer runs the intended scraper command. The validated result overwrites a source file, configuration file, or workflow reachable with the developer's permissions. The generated-file review comment is not a security boundary because the overwrite happens before review.

**Fix:**

1. Require a strict slug such as `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` for `card.id`.
2. Require `parsed.card.issuer === issuer` after extraction and keep an issuer allowlist in the runtime validator.
3. Compute both root and destination with `resolve()`, then reject unless `relative(root, destination)` is non-empty, does not start with `..`, and is not absolute.
4. Refuse to overwrite an existing file unless an explicit `--force` option is supplied.
5. Add a test that feeds traversal values through the real validator and writer path using a temporary directory.

## SR-02 — Catalog URL reaches a clickable anchor without a safe-protocol check

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed vulnerable path; current corpus is clean
**Files/regions:**

- `packages/rules/src/schema.ts:41-57`
- `scripts/build-json.ts:54-67,224-239,381-428`
- `apps/web/src/lib/cards.ts:135-157,261-309`
- `apps/web/src/components/cards/CardDetail.svelte:172-176`
- `apps/web/src/layouts/Layout.astro:38-50`

**Evidence:** Both the canonical schema and the relaxed build schema accept any string for `card.url`. The build copies the value into public JSON; the browser casts fetched JSON to `CardsJson` without runtime validation; `getCardById()` forwards the string; and `CardDetail` binds it directly to `href`. The CSP explicitly permits inline script through `'unsafe-inline'`, so a user-clicked `javascript:` URL is not neutralized by the current policy.

The current data audit found 480 HTTP(S) URLs, 203 empty URLs, and zero other protocols. This prevents an immediate exploit in the checked-in artifact but does not close the generation/deployment path. The prior cycle-1 plan scheduled this fix, yet the current source still has no guard.

**Exploit scenario:** A scraper prompt injection or overlooked manual edit emits `url: "javascript:..."`. The catalog is rebuilt and deployed. A visitor clicks “공식 카드 페이지,” executing script in the application origin and exposing same-origin `sessionStorage` analysis data.

**Fix:**

1. Validate with a shared refinement that parses the URL and permits only `http:` and `https:`.
2. Reuse the canonical schema in `build-json.ts`; do not maintain a relaxed URL contract.
3. Add a runtime `safeExternalUrl()` guard before rendering the anchor and omit invalid links.
4. Add build and component tests for `javascript:`, `data:`, protocol-relative, whitespace/control-character, and malformed URLs.

## SR-03 — Clickjacking protection is expressed in ineffective meta tags

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `apps/web/src/layouts/Layout.astro:50-53`
- `.github/workflows/deploy.yml:37-55`

**Evidence:** `frame-ancestors 'none'` appears in a CSP meta element, but `frame-ancestors` is not enforced when delivered through meta CSP. `X-Frame-Options` and `X-Content-Type-Options` likewise require HTTP response headers; `<meta http-equiv>` does not turn them into response headers. The deployment uploads a static artifact to GitHub Pages and contains no header-producing middleware, proxy, or host configuration. The cycle-34 verification only checked that the meta elements existed, not that a browser received enforceable headers.

**Exploit scenario:** A malicious site frames the upload/dashboard UI and overlays controls to induce clicks or file-selection actions. Same-origin policy limits direct reading by the parent, but UI redressing remains possible around a financial-statement workflow.

**Fix:** Serve the application through a host/CDN/worker that can emit an actual response CSP with `frame-ancestors 'none'`, plus `X-Content-Type-Options: nosniff`, an appropriate `Referrer-Policy`, and preferably HSTS. If GitHub Pages must remain the origin, document that the meta entries do not provide those controls rather than treating them as verified protection.

## SR-04 — Scraper accepts arbitrary network targets and buffers unbounded bodies

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed; SSRF portion is known-deferred, but its recorded rationale is stale
**Files/regions:**

- `tools/scraper/src/cli.ts:19-37,88-104`
- `tools/cli/src/commands/scrape.ts:18-26,40-64`
- `tools/scraper/src/fetcher.ts:13-63`
- `.context/plans/00-deferred-items.md:1894-1901`

**Evidence:** `--url` is forwarded verbatim to `fetch()`. Redirects are followed by default, with no scheme, hostname, resolved-IP, or redirect-target validation. Both `response.text()` and `response.arrayBuffer()` buffer the full response; the 40,000-character truncation occurs later in `extractor.ts`, after download and allocation. The EUC-KR refetch repeats the request and does not check the second response's status. The deferred-item rationale claims “URL validation already exists (hostname whitelist),” but no such check exists in the current fetch path.

**Exploit scenario:** If a wrapper, CI job, or copied command takes a URL from an issue or other untrusted source, the scraper can request loopback/private/link-local services. A hostile public endpoint can also stream a very large response within the 30-second window and exhaust the CLI process's memory.

**Fix:**

1. Parse URLs before fetching and permit only HTTP(S).
2. Default to the configured issuer host; require an explicit unsafe override for other hosts.
3. Resolve and reject loopback, private, link-local, and metadata IP ranges, and repeat validation for every redirect.
4. Stream with a hard byte limit and validate `Content-Length` when present.
5. Check status/content type on the EUC-KR refetch and clear its timeout in `finally`.

## Final security sweep

- No committed API key/private-key material was found by targeted secret-pattern and key-file scans.
- The CLI's remote LLM fallback has an explicit consent path and validates its structured response.
- Generated HTML report strings consistently pass through `esc()` at user/catalog text insertion points.
- The only Svelte raw-HTML sink is `Icon.svelte:56`, indexed from a compile-time constant map rather than user data.
- The client fetches card/category data from same-origin relative paths.
- Plaintext statement persistence in `sessionStorage` and CSP `'unsafe-inline'` are already documented threat-model/deferred items; this review does not duplicate them as new findings.
- No Playwright, Chrome, browser, or E2E process was started during this review.
