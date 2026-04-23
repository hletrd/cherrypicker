# Cycle 9 — security-reviewer

Scope: repo-wide security re-scan post cycle-8.

## Summary

No new security findings this cycle.

## Carry-overs

- **D7-M13** — `unsafe-inline` in script-src CSP. Severity MEDIUM / High confidence. Unchanged. Astro does not yet emit nonces for inline hydration scripts; tracking upstream.
- **D-32** — no SRI on inline scripts. Severity LOW. Unchanged (is:inline → same-origin embed, out of supply-chain attack surface).

## Verification of cycle-8 surface

- `apps/web/src/lib/store.svelte.ts` persistence path: `persistToStorage` still uses try/catch around `sessionStorage.setItem` with QuotaExceededError handling and the `PersistWarningKind` differentiation from C7-11. No regression.
- `apps/web/src/components/upload/FileDropzone.svelte` input validation: `parsePreviousSpending` correctly handles `-0`, `Infinity`, and exponent notation post-C4-12 + C8-02. Aria-busy added C8-03.
- PDF LLM fallback (`packages/parser/src/pdf/llm-fallback.ts`): no new data-exfil surfaces; API key never logged (cycle-5 guardrails hold).

Confidence: High. Zero new security findings.
