# Review-plan-fix Cycle 10 — security reviewer

- Date: 2026-07-24
- Baseline: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Final count: **1 Medium finding**

## Inventory and coverage

I inventoried all 2,252 tracked paths before the final sweep. The tree contains
1,096 `.context` paths and 1,156 active product, data, test, workflow,
configuration, documentation, and vendor-integrity paths. The active source
inventory includes 78 web, 26 core, 35 parser, 14 rules, 9 visualization,
16 CLI, and 12 scraper source paths, plus 19 scripts, 16 E2E paths, and all
683 authored card-rule YAML files. Existing untracked Cycle 42 artifacts were
preserved.

The review traced:

- browser upload admission, every parser family, XLSX archive preflight,
  parser/optimizer workers, persisted financial state, external links,
  Svelte/HTML sinks, CSP, and static-host framing behavior;
- CLI statement inputs, local-first remote-LLM consent, terminal output,
  standalone report escaping/CSP, filesystem ownership, no-follow opens,
  and atomic writes;
- scraper arguments through issuer/host policy, DNS/IP resolution and socket
  pinning, redirect revalidation, bounded response reads, untrusted-page LLM
  extraction, deterministic validation, quarantine, and YAML publication;
- canonical rule/catalog validation, generated artifact identity, manifests,
  lockfile and overrides, vendored SheetJS digests, workflow permissions and
  action pinning, credential-shaped literals, and dependency audit policy.

There is no application account, cookie, server session, or privileged API
surface: the deployed product is a static client application and the remaining
authorization decision is the CLI's explicit remote-LLM consent boundary.

## RPF10-SEC-001 — model-authored URL can be published as an “official” phishing link

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **CWE / OWASP:** CWE-346 (Origin Validation Error); improper handling of
  untrusted LLM output
- **Locations:**
  - `tools/scraper/src/prompts/schemas.ts:24-68`
  - `tools/scraper/src/cli.ts:127-169`
  - `tools/scraper/src/extractor.ts:68-116,126-155`
  - `packages/rules/src/security.ts:30-55`
  - `scripts/catalog-publication.ts:195-223`
  - `apps/web/src/components/cards/CardDetail.svelte:140-144,265-272`
  - `README.md:202-213`

The Cycle 9 quarantine correctly stamps issuer, source, and date outside model
authority and downgrades model-supported rewards. It still leaves `card.url`
under model control. The extraction tool explicitly accepts that field, while
the CLI already knows the validated fetched `targetUrl` but passes only cleaned
page text and issuer into extraction. The canonical URL guard establishes only
that the value is an absolute credential-free HTTP(S) URL; it does not establish
that the host or URL belongs to the fetched issuer source.

This matters before reward promotion. Unsupported-only active cards remain in
the public detail shards, and the README says pending output is visible in the
catalog. `CardDetail` accepts any URL that passes the scheme guard and labels
the resulting anchor “공식 카드 페이지.” `noopener noreferrer` protects the
opener but does not make the destination authentic.

An executable in-memory probe used the production extraction, publication, and
click guards with a structurally valid model response containing
`https://attacker.example/phish`. The exact baseline returned:

```text
publishedUrl=https://attacker.example/phish
clickHref=https://attacker.example/phish
rewardSupport=unsupported:pending_source_review
```

**Failure scenario:** a compromised issuer page, an explicitly added source
host, hidden prompt-injection text, or an ordinary model hallucination causes
the tool response to name an attacker-controlled HTTPS URL. A maintainer runs
the scraper at its default canonical output location and publishes the
quarantined card without noticing the URL; no reward needs to be promoted.
A user then trusts the “official” label, follows the link, and reaches a
credential or card-application phishing page.

**Fix:**

1. Remove `card.url` from the model-owned extraction schema, as already done
   for issuer, source, and extraction date.
2. Thread trusted request provenance into the extraction boundary. Stamp an
   exact policy-validated fetched/final URL outside the model, or leave the
   field absent until a reviewer explicitly supplies it. If redirects matter,
   return the validated final URL with the fetched body.
3. Make publication fail closed for `source: llm-scrape` when a URL lacks that
   non-model provenance; scheme validation alone is insufficient.
4. Add an adversarial regression in which the tool response supplies a safe-
   scheme off-policy URL and prove extraction overwrites or omits it, the
   generated detail shard cannot retain it, and the official-link guard never
   renders it.

## Verification and deduplication

- `bun run dependencies:check`: passed; direct imports, remote-reference policy,
  and vendored archive digests were valid.
- `bun run security:audit`: passed; Bun reported no vulnerabilities.
- 158 focused non-browser security tests across rules, scraper extraction,
  validators, network/fetch/writer controls, PDF LLM fallback, external URLs,
  frame guard, and CLI report output passed with 0 failures.
- Every workflow action is pinned to a full 40-hex commit. Workflow permissions
  remain job-scoped, checkout credentials are not persisted, and the lockfile is
  frozen in deployment.
- The active-tree secret sweep found only deliberately fake test literals; no
  repository credential or private key was found.

The known static-host `unsafe-inline` CSP limitation, plaintext same-origin
`sessionStorage`, CLI whole-file resource debt, and PDF LLM blacklist/prompt
injection limitations were already recorded and were not counted again. The
Cycle 9 reward-source finding was verified closed at its intended execution
boundary rather than resurrected. The prefixed/leading-NUL XLSX hypothesis was
also excluded: prior corrected tracing showed that non-`PK` input routes to
SheetJS plaintext/PRN handling and does not bypass ZIP inflation budgets.

## Final missed-issue sweep

The final sweep rechecked secrets, authentication/authorization applicability,
XSS and raw-HTML ownership, terminal injection, unsafe URL schemes, SSRF and
DNS rebinding, redirect authority, response and parser resource budgets,
deserialization/prototype boundaries, LLM input/output trust, sensitive browser
storage, path traversal, symlink/TOCTOU writes, temporary-file cleanup,
dependency provenance, workflow privilege, and action pinning. No Critical,
High, or second genuinely new non-duplicate security finding met the evidence
threshold.

No source, test, plan, generated artifact, protected Cycle 42 file, browser/E2E
state, commit, push, or deployment was changed.
