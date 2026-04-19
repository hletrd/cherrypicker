# Security Review — Cycle 2 (2026-04-19)

Reviewer: security-reviewer angle
Scope: All source files, configuration, dependencies

---

## Finding C2-S01: LLM fallback API key exposure risk

**File:** `packages/parser/src/pdf/llm-fallback.ts:34-36`
**Severity:** HIGH
**Confidence:** High

The `ANTHROPIC_API_KEY` is read from `process.env` and passed directly to the Anthropic client. While this is standard practice, the concern is that this code runs as part of the `packages/parser` which is importable from the Bun CLI tool. If someone were to accidentally bundle this for browser use (the web app already has a browser-side PDF parser), the environment variable could leak.

Currently the web app uses `apps/web/src/lib/parser/pdf.ts` which does NOT import the LLM fallback, so this is safe. But there is no guard preventing a future developer from importing it.

**Fix:** Add a runtime guard at the top of `parsePDFWithLLM`:
```ts
if (typeof window !== 'undefined') {
  throw new Error('LLM fallback is not available in browser environments');
}
```

---

## Finding C2-S02: CSP still includes `'unsafe-inline'` for script-src

**File:** `apps/web/src/layouts/Layout.astro:49`
**Severity:** MEDIUM
**Confidence:** High

Previously reported as M-01. The CSP meta tag includes `'unsafe-inline'` for `script-src`, which is required for Astro's Svelte island hydration. The comment explains this and adds `'strict-dynamic'` for forward compatibility. However, `'strict-dynamic'` is only effective in CSP Level 3 browsers; in Level 2 browsers, `'unsafe-inline'` takes full effect.

**Status:** Acknowledged as a known limitation with documented TODO to migrate to hash-based CSP. No new action needed this cycle.

---

## Finding C2-S03: `<script is:inline>` loads external script bypassing CSP hash

**File:** `apps/web/src/layouts/Layout.astro:53`
**Severity:** MEDIUM
**Confidence:** Medium

```html
<script is:inline src="/cherrypicker/scripts/layout.js"></script>
```

The `is:inline` attribute forces Astro to embed this script tag as-is in the HTML output. With the current CSP (`script-src 'self' 'strict-dynamic' 'unsafe-inline'`), this works because `'unsafe-inline'` allows it. But if `'unsafe-inline'` is ever removed, this script will be blocked by CSP since it's not hash-based and `is:inline` prevents Astro from bundling it.

**Fix:** When migrating away from `'unsafe-inline'`, remove `is:inline` and let Astro bundle the script, or compute its SHA256 hash and add it to the CSP.

---

## Finding C2-S04: No input sanitization on merchant names before display

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:253`
**Severity:** MEDIUM
**Confidence:** Medium

Merchant names from parsed CSV/XLSX/PDF are displayed directly in the table via `{tx.merchant}`. In Svelte 5, text interpolation auto-escapes HTML, so XSS via merchant name is not possible. However, the `title` attribute also uses the raw merchant name:
```svelte
<td class="px-3 py-2 font-medium max-w-[200px] truncate" title={tx.merchant}>
```

In Svelte, attribute values are also auto-escaped, so this is safe. No action needed — Svelte's default escaping protects against injection.

**Status:** Verified safe (no action needed).

---

## Finding C2-S05: `sessionStorage` stores full optimization result without integrity check

**File:** `apps/web/src/lib/store.svelte.ts:96-112`
**Severity:** LOW
**Confidence:** Medium

The `persistToStorage` function stores the full `AnalysisResult` including optimization data in `sessionStorage`. While `sessionStorage` is same-origin and not accessible cross-site, a malicious browser extension or XSS (if one were introduced) could modify the stored data. The `loadFromStorage` function does minimal validation — it checks that `optimization.assignments` is an array and `totalReward` is a number, but doesn't validate individual assignment values.

**Fix:** Consider adding a lightweight integrity hash or more thorough validation of the stored data shape.

---

## Finding C2-S06: Regex DoS potential in bank detection patterns

**File:** `apps/web/src/lib/parser/detect.ts:10-105`, `packages/parser/src/detect.ts:10-105`
**Severity:** LOW
**Confidence:** Low

The `BANK_SIGNATURES` array contains regex patterns that are tested against file content. Most are simple Korean/English string matches with no backtracking risk. The only pattern with minor concern is `/SAMSUNG\s*CARD/i` which uses `\s*` — this is fine because it's bounded by the literal `CARD` following it. No actual ReDoS vulnerability found.

**Status:** Verified safe (no action needed).
