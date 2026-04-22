# Security Review -- Cycle 1 (2026-04-22)

## Findings

### SR-01: LLM fallback sends user PDF text to external API
- **File**: `packages/parser/src/pdf/llm-fallback.ts:33-129`
- **Problem**: The LLM fallback sends up to 8000 characters of extracted PDF text to the Anthropic API. This text may contain personally identifiable information (names, account numbers, transaction details) from credit card statements.
- **Failure scenario**: A user's full credit card statement text (including name, card number fragments, and transaction history) is sent to an external API without explicit user consent or data minimization.
- **Suggested fix**: Add a data sanitization step that strips or masks PII before sending to the API. Require explicit user opt-in before LLM fallback is used. Document the data flow clearly.
- **Confidence**: High (clear PII exposure risk)

### SR-02: LLM fallback API key from environment without validation
- **File**: `packages/parser/src/pdf/llm-fallback.ts:39-41`
- **Problem**: `process.env['ANTHROPIC_API_KEY']` is read directly and passed to the Anthropic client without validation. If the key is malformed or a test key, the error is deferred to the API call.
- **Failure scenario**: An accidentally committed `.env` file with a real API key could be exposed. The error message on line 40 reveals the key is expected in the environment.
- **Suggested fix**: Validate the key format before use. Never include the key in error messages. Use a secrets manager in production.
- **Confidence**: Medium (standard practice issue, not an active vulnerability)

### SR-03: sessionStorage stores optimization results in cleartext
- **File**: `apps/web/src/lib/store.svelte.ts:96-191`
- **Problem**: Analysis results (including transaction details with merchant names and amounts) are stored in sessionStorage as cleartext JSON. Any XSS vulnerability would expose all user financial data.
- **Failure scenario**: An XSS attack reads `sessionStorage.getItem('cherrypicker:analysis')` and exfiltrates the user's complete transaction history and card optimization results.
- **Suggested fix**: Encrypt sensitive data before storing in sessionStorage, or store only non-sensitive summary data and recompute on page load.
- **Confidence**: Medium (depends on XSS surface area; sessionStorage is origin-scoped)

### SR-04: CardDetail external link opens without noreferrer-only protection
- **File**: `apps/web/src/components/cards/CardDetail.svelte:167-169`
- **Problem**: The card URL link uses `target="_blank" rel="noopener noreferrer"`. While `noopener` prevents the `window.opener` reference, `noreferrer` strips the Referer header, which is good. However, the URL itself comes from the card YAML data and is not validated.
- **Failure scenario**: A maliciously crafted card YAML could include a `javascript:` or `data:` URL that executes when clicked. The Zod schema only validates `z.string().optional()` for the URL field (schema.ts:55).
- **Suggested fix**: Add URL validation (must start with `https://` or `http://`) to the cardMetaSchema, or at minimum sanitize the URL before rendering.
- **Confidence**: Medium (YAML data is curated, but the schema allows any string)

### SR-05: JSON.parse of sessionStorage data without try/catch at load
- **File**: `apps/web/src/lib/store.svelte.ts:227`
- **Problem**: `JSON.parse(raw)` is inside a try/catch, but the parsed result is used with property access without full validation. The validation on lines 253-260 only checks the top-level optimization structure, not nested arrays deeply.
- **Failure scenario**: Crafted sessionStorage data with valid top-level structure but malicious nested values (e.g., prototype-polluting `__proto__` keys in transaction objects) could affect application behavior.
- **Suggested fix**: Use a Zod schema to validate the full persisted data structure on load, similar to how card YAML is validated.
- **Confidence**: Low (sessionStorage is origin-scoped; attacker would need XSS first)

### SR-06: No Content Security Policy headers observed
- **File**: `apps/web/` (project-wide)
- **Problem**: No CSP configuration was found in the Astro config or middleware. Without CSP, inline scripts and external resource loading are unrestricted.
- **Failure scenario**: An XSS injection could load external scripts, exfiltrating user data.
- **Suggested fix**: Add CSP headers via Astro middleware or server configuration.
- **Confidence**: Low (common in development setups; should be addressed before production)
