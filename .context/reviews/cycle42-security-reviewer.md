# Security Review — Cycle 42

## SEC-42-01: safeJSONParse key list incomplete (Low, carryover)
**File:** `apps/web/src/lib/store.svelte.ts:220-231`
**Confidence:** Medium

The `FORBIDDEN_KEYS` set in `safeJSONParse` omits several prototype-pollution vectors:
- `__proto__`, `constructor`, `prototype` are covered
- Missing: `constructor.prototype`, nested prototype access via arrays
- Missing: `__proto` (without trailing underscore, used by some polyfills)

Impact is low: modern browsers have hardened `JSON.parse` against prototype pollution, and the application does not use the parsed data in ways that would trigger prototype chain lookup for malicious properties.

**Fix:** Expand FORBIDDEN_KEYS or replace safeJSONParse with a reviver that only allows expected keys (whitelist approach).

---

## SEC-01 carryover: CSP unsafe-inline (Medium)
**File:** `apps/web/src/layouts/Layout.astro:50`
**Confidence:** High

Still present. The CSP includes `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`. The comment explains these are required by Astro and Tailwind CSS v4 respectively.

**Fix:** Evaluate nonce-based CSP or Astro's built-in CSP generation.
