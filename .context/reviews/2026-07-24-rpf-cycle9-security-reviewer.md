# RPF Cycle 9 — Security Reviewer

Date: 2026-07-24
Reviewed revision: `c5c6eab9b421e547d66716e989e08c747cc36aa1`
Disposition: **changes requested**

## Inventory and coverage

I enumerated all 2,232 tracked paths before reviewing. The product/configuration/test/documentation scope contains 1,153 tracked paths outside `.context`: 683 card-rule YAML files, 24 issuer README files, and 446 application, package, tool, script, workflow, configuration, generated-catalog, end-to-end-test, and vendor-integrity paths. Historical `.context` review bodies were excluded; the current repository policies and Cycle 8 plans were read as review context.

The security pass covered:

- every parser adapter and its server/browser entry points, upload admission, archive handling, encoding detection, and parser parity tests;
- analysis persistence, session storage, report rendering/escaping, navigation, and client-only deployment boundaries;
- optimizer/rule validation and the full YAML/public-JSON catalog boundary;
- CLI path validation, local-first parsing, remote-LLM consent, secret handling, and output behavior;
- scraper argument parsing, URL/host/DNS/IP/redirect policy, response budgets, LLM extraction, schema validation, and atomic/symlink-safe writes;
- dependency manifests, lockfile, vendored SheetJS integrity files, workflow action pinning, build scripts, documentation commands, and all focused security tests.

Validation evidence:

- `bun audit` — passed, no vulnerabilities reported.
- `bun test tools/scraper/__tests__/network-policy.test.ts tools/scraper/__tests__/fetcher.test.ts tools/scraper/__tests__/writer.test.ts packages/parser/__tests__/xlsx-archive.test.ts packages/viz/__tests__/report.test.ts` — 56 passed, 0 failed.
- `bun scripts/check-dependencies.ts` — passed, including vendored dependency integrity.
- A tracked-tree credential-pattern sweep found only deliberately fake test fixtures; no repository credential was found.

Previously fixed truncation provenance, normalized replacement-card selection, card/category allocation cross-checks, all-unassigned counts, and ambiguous-v2 migration findings were checked and not re-reported.

Rejected competing hypothesis: a leading-NUL XLSX was initially suspected of bypassing ZIP budgets because direct `XLSX.read` returned a workbook named `Sheet1`. Source tracing and a corrected probe disproved it. SheetJS dispatches non-`PK` input to its PRN/plaintext reader rather than `read_zip` (`node_modules/xlsx/xlsx.mjs:27239-27262`); `parseXLSXBuffer` returned zero transactions and `헤더 행을 찾을 수 없습니다.` The original workbook sheet was not preserved and no ZIP inflation occurred.

## Findings

### SEC-01 — Scraped page instructions and card facts share one untrusted LLM message

- Severity: **Medium**
- Confidence: **Medium**
- Classification: **manual-validation**
- CWE / OWASP mapping: CWE-77 (Improper Neutralization of Special Elements in a Command); OWASP LLM01 Prompt Injection
- Locations:
  - `tools/scraper/src/extractor.ts:97-123`
  - `tools/scraper/src/prompts/system.ts:12-68`
  - `tools/scraper/src/args.ts:42-55`
  - `README.md:177-200`

The scraper interpolates the entire fetched page directly into the user message. The system prompt describes the desired extraction but never establishes that page text is untrusted data whose instructions must be ignored. Tool/schema validation constrains shape, not truth: a page instruction can ask for attacker-chosen but structurally valid `supported` reward rules. `--allow-host` also intentionally lets an operator process public hosts outside the built-in issuer set.

Concrete failure scenario: a compromised issuer page, third-party host explicitly added with `--allow-host`, or hidden page content says to ignore prior instructions and emit a high-value supported reward. The model returns valid YAML-compatible data, validation accepts it, and the scraper writes a new catalog entry (or replaces one when the operator supplied `--force`). The README's manual source review can catch this, but the pipeline does not mechanically preserve or verify evidence for each extracted fact.

Suggested fix:

1. State in the system prompt that fetched content is untrusted evidence, never instructions, and wrap it in a clearly delimited data block. This is defense in depth, not a complete prompt-injection solution.
2. Extend extraction output with source evidence for each material value (bounded quotation/location or structured source field), then require a deterministic review step to compare rates, caps, conditions, and URL/issuer against the fetched source.
3. Keep LLM-scraped rewards quarantined or `unsupported` until an explicit audited promotion step records reviewer approval. Do not let `data:build` alone imply source fidelity.
4. Add adversarial extraction tests using page text that requests instruction override and verify that it cannot silently produce publishable supported rules.

## Final missed-issues sweep

I rechecked authorization/consent, secret exposure, path traversal and symlink handling, SSRF/DNS rebinding/redirect handling, response-size and timeout budgets, archive dispatch/inflation, HTML/report injection, persisted-state validation, dependency integrity, workflow pinning, destructive scraper writes, and browser deployment headers. The archive, SSRF, and writer boundaries are well defended by offset-zero ZIP dispatch, archive budgets, exact allowlists, public-IP resolution/pinning, redirect revalidation, bounded fetches, and atomic no-follow writes. No Critical or High-confidence security issue was retained.
