# Security Reviewer — Cycle 12

**Date:** 2026-04-24
**Reviewer:** security-reviewer

## Findings

### C12-SR01: LLM fallback exposes API key via `process.env` read [LOW]
- **File:** `packages/parser/src/pdf/llm-fallback.ts:38-43`
- **Description:** The LLM fallback reads `ANTHROPIC_API_KEY` from `process.env` and passes it directly to the Anthropic SDK client. The key is never logged or exposed in output, but the function has a runtime guard (`typeof window !== 'undefined'` check) preventing browser execution. The API key is only accessible server-side. This is the expected pattern for server-side API usage — not a vulnerability.
- **Confidence:** High
- **Severity:** LOW (informational, acceptable pattern)

### C12-SR02: `loadCardsData` fetches static JSON without integrity verification [LOW]
- **File:** `apps/web/src/lib/cards.ts:205-208`
- **Description:** `loadCardsData` fetches `cards.json` via HTTP and trusts the response without Subresource Integrity (SRI) or content hash verification. If the hosting CDN were compromised, malicious card data could be injected, potentially leading to incorrect optimization results. However, since this is a client-side app deployed on GitHub Pages, the attack surface is limited to CDN compromise (which SRI would mitigate for static assets). Adding SRI would require build-time hash generation.
- **Confidence:** Medium
- **Severity:** LOW (CDN compromise scenario, already deferred as D-05/D-31 variant)

### C12-SR03: sessionStorage data parsed without schema validation [LOW]
- **File:** `apps/web/src/lib/store.svelte.ts:222-330`
- **Description:** `loadFromStorage` parses sessionStorage JSON and performs shallow field-level validation (type checks on individual fields), but does not validate the full schema. A crafted sessionStorage payload could contain extra fields that survive the load and are spread into the result object. However, since the `AnalysisResult` interface only exposes known fields and no code iterates over unknown keys, this is not exploitable.
- **Confidence:** High
- **Severity:** LOW

## Convergence Note

No new HIGH or MEDIUM security findings. All three findings are LOW-severity and consistent with previously deferred items. The codebase correctly guards against browser-side API key exposure, validates sessionStorage data structurally, and handles AbortError gracefully.
