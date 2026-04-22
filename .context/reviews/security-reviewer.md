# Security Review Report

**Scope:** Full monorepo — `packages/core`, `packages/parser`, `packages/rules`, `packages/viz`, `apps/web`, `tools/cli`, `tools/scraper`, `scripts/`, `e2e/`
**Date:** 2026-04-22
**Reviewer:** Security Reviewer (Claude Opus 4.6)
**Risk Level:** MEDIUM

## Summary
- Critical Issues: 0
- High Issues: 3
- Medium Issues: 4
- Low Issues: 3
- Info (Positive Findings): 5

The cherrypicker project has a fundamentally sound security posture. The web app is a static Astro site that processes all user data client-side — no server-side endpoints handle user uploads, eliminating entire classes of server-side injection and data-exfiltration risks. The most significant findings are dependency vulnerabilities and a missing URL allowlist in the scraper tool (which is developer-only, not user-facing). No hardcoded secrets, no `innerHTML`/`{@html}` usage, and proper HTML escaping in report generation were found.

---

## High Issues (Fix Within 1 Week)

### 1. Dependency Vulnerabilities — 9 HIGH and 4 MODERATE CVEs
**Severity:** HIGH
**Category:** A06 — Vulnerable and Outdated Components
**Location:** Root `bun.lock` (transitive dependencies)
**Exploitability:** Varies — dev-time and build-time only for most; Vite dev server CVEs are exploitable during development
**Blast Radius:** Arbitrary file read/write (tar), prototype pollution (defu), XSS (Astro), arbitrary file read via dev server (Vite)
**Confidence:** HIGH

`bun audit` reports 13 vulnerabilities:

| Package | CVE | Severity | Impact |
|---------|-----|----------|--------|
| `tar <7.5.7` | GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-h96w, GHSA-9ppj-qmqm-q256, GHSA-r6q2-hw4h-h46w | HIGH (6) | Arbitrary file creation/overwrite via path traversal, symlink poisoning |
| `defu <=6.1.4` | GHSA-737v-m6q7-c878 | HIGH | Prototype pollution via `__proto__` key |
| `vite >=7.0.0 <=7.3.1` | GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583 | HIGH | Arbitrary file read via dev server WebSocket; `server.fs.deny` bypass |
| `yaml >=2.0.0 <2.8.3` | GHSA-48c2-rrv3-qjmp | MODERATE | Stack overflow via deeply nested YAML |
| `brace-expansion <1.1.13` | GHSA-f886-m6hf-6m8v | MODERATE | Process hang and memory exhaustion |
| `astro <6.1.6` | GHSA-j687-52p2-xcff | MODERATE | XSS in `define:vars` via incomplete `</script>` tag sanitization |
| `vite >=7.0.0 <=7.3.1` | GHSA-4w7w-66w2-5vf9 | MODERATE | Path traversal in optimized deps `.map` handling |

**Remediation:** Run `bun update` to update all dependencies to latest compatible versions. For transitive dependencies that cannot be updated directly, add `overrides` in the root `package.json`:

```json
// BAD: vulnerable versions pinned by transitive deps
// GOOD: force resolution in package.json
{
  "overrides": {
    "tar": "^7.5.7",
    "defu": "^6.1.5",
    "yaml": "^2.8.3",
    "brace-expansion": "^1.1.13"
  }
}
```

---

### 2. SSRF in Scraper — No URL Validation or Allowlisting
**Severity:** HIGH
**Category:** A10 — Server-Side Request Forgery
**Location:** `tools/scraper/src/fetcher.ts:10-50`, `tools/scraper/src/cli.ts:94`
**Exploitability:** Local, authenticated (developer must run the scraper CLI with `--url` flag)
**Blast Radius:** Internal network scanning, cloud metadata endpoint access (169.254.169.254), data exfiltration from internal services
**Confidence:** HIGH

The `fetchCardPage()` function accepts any URL and fetches it without validation:

```typescript
// BAD: no URL validation
export async function fetchCardPage(url: string): Promise<string> {
  const response = await fetch(url, {  // arbitrary URL fetched
    headers: { 'User-Agent': USER_AGENT, ... },
  });
```

The `--url` CLI argument flows directly from user input to `fetchCardPage()`:

```typescript
// tools/scraper/src/cli.ts:94
const targetUrl = urlOverride ?? target.baseUrl;
const html = await fetchCardPage(targetUrl);
```

An attacker with access to the CLI could fetch internal network resources, cloud metadata endpoints, or any reachable URL from the machine running the scraper.

**Remediation:** Add a URL allowlist based on known Korean card issuer domains:

```typescript
// GOOD: validate URL against allowlist
const ALLOWED_HOSTS = [
  'card.kbcard.com', 'www.kbcard.com',
  'card.hyundaicard.com', 'www.hyundaicard.com',
  'card.shinhancard.com', 'www.shinhancard.com',
  // ... all known issuer domains
];

function validateScraperUrl(url: string): void {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`Invalid URL protocol: ${parsed.protocol}`);
  }
  if (!ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))) {
    throw new Error(`URL host not in allowlist: ${parsed.hostname}`);
  }
  // Block internal/private IPs
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|::1|fc|fd)/.test(parsed.hostname)) {
    throw new Error(`Private/internal IP addresses are not allowed: ${parsed.hostname}`);
  }
}
```

---

### 3. CSP Allows `unsafe-inline` in script-src — Weakens XSS Protection
**Severity:** HIGH
**Category:** A05 — Security Misconfiguration
**Location:** `apps/web/src/layouts/Layout.astro:42`
**Exploitability:** Remote — an attacker who achieves HTML injection can execute arbitrary JavaScript
**Blast Radius:** Full page compromise — stealing sessionStorage data (analysis results), performing actions on behalf of the user
**Confidence:** HIGH

The Content-Security-Policy meta tag includes `script-src 'self' 'unsafe-inline'`:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; worker-src 'self' blob:; connect-src 'self';" />
```

The code comments acknowledge this is required for Astro's Svelte island hydration and layout.js theme toggle. `unsafe-inline` completely negates CSP's ability to prevent inline script injection attacks.

**Remediation:** Migrate to nonce-based CSP as the existing TODO suggests. Compute a nonce at build time and inject it into both the CSP meta tag and all `<script>` elements:

```typescript
// GOOD: nonce-based CSP (in an Astro middleware or integration)
// astro.config.ts — custom integration
const cspNonce = crypto.randomUUID();

// In Layout.astro:
// <meta http-equiv="Content-Security-Policy"
//   content="default-src 'self'; script-src 'self' 'nonce-{cspNonce}'; style-src 'self' 'unsafe-inline'; ..." />
// <script nonce={cspNonce} src={...}></script>
```

Note: Full nonce injection requires an Astro integration to rewrite all script tags at build time. This is a non-trivial change. As an interim measure, the current CSP still provides value by restricting `connect-src`, `img-src`, `font-src`, and `worker-src`.

---

## Medium Issues (Fix Within 1 Month)

### 4. Unsafe JSON.parse of LLM Output Without Schema Validation
**Severity:** MEDIUM
**Category:** A03 — Injection (Unsafe Deserialization)
**Location:** `packages/parser/src/pdf/llm-fallback.ts:86-108`
**Exploitability:** Requires (a) the user to parse a PDF that fails structured parsing, (b) explicit opt-in via `--allow-remote-llm`, and (c) a compromised or adversarial LLM response
**Blast Radius:** Malformed transaction data injected into the optimization engine — could produce incorrect financial recommendations
**Confidence:** MEDIUM

The LLM fallback parses the model's text response via regex + `JSON.parse` without Zod schema validation:

```typescript
// BAD: no schema validation after JSON.parse
const jsonMatch = responseText.match(/\[[\s\S]*\](?=\s*$|\s*```)/);
// ...
parsed = JSON.parse(jsonMatch[0]);  // unvalidated LLM output
```

In contrast, the scraper's `extractCardRules()` properly validates LLM output through `validateExtractedRules()` which uses the Zod `cardRuleSetSchema`. The parser's llm-fallback path lacks this defense.

**Remediation:** Apply Zod schema validation to the LLM fallback output, matching the scraper's pattern:

```typescript
// GOOD: validate with Zod
import { z } from 'zod';

const LLMTransactionSchema = z.object({
  date: z.string().min(1),
  merchant: z.string().min(1),
  amount: z.number().positive().finite(),
  installments: z.number().int().positive().optional(),
});

const LLMResponseSchema = z.array(LLMTransactionSchema);

// After JSON.parse:
const validated = LLMResponseSchema.parse(parsed);  // throws on invalid data
```

---

### 5. SessionStorage Deserialization Without Schema Validation
**Severity:** MEDIUM
**Category:** A03 — Injection (Unsafe Deserialization)
**Location:** `apps/web/src/lib/store.svelte.ts:227-315`
**Exploitability:** Local — requires ability to write to sessionStorage (XSS, browser extension, physical access)
**Blast Radius:** Injection of malicious data into the optimization engine via the `transactions`, `optimization`, or `monthlyBreakdown` fields
**Confidence:** MEDIUM

The `loadFromStorage()` function calls `JSON.parse(raw)` on sessionStorage data and performs manual field checks:

```typescript
// MEDIUM RISK: manual validation without schema enforcement
let parsed = JSON.parse(raw);  // any shape accepted
if (parsed && typeof parsed === 'object' &&
    parsed.optimization &&
    Array.isArray(parsed.optimization.assignments) && ...) {
  // ... manually reconstruct the result
```

Manual field checks are error-prone and can miss deeply nested properties. A crafted payload could pass shallow checks while containing malicious values in nested fields.

**Remediation:** Use Zod schema validation for the persisted data shape:

```typescript
// GOOD: schema validation
const PersistedSchema = z.object({
  success: z.boolean(),
  bank: z.string().nullable(),
  format: z.string(),
  optimization: OptimizationResultSchema,
  transactions: z.array(CategorizedTxSchema).optional(),
  // ... all other fields
});

const parsed = PersistedSchema.safeParse(JSON.parse(raw));
if (!parsed.success) { sessionStorage.removeItem(STORAGE_KEY); return null; }
return parsed.data;
```

---

### 6. Scraper Writer — Path Traversal via Card ID
**Severity:** MEDIUM
**Category:** A01 — Broken Access Control (Path Traversal)
**Location:** `tools/scraper/src/writer.ts:14-17`
**Exploitability:** Local, authenticated (developer must run the scraper) — requires a malicious card ID containing `../` sequences from LLM output
**Blast Radius:** File write to arbitrary paths on the filesystem
**Confidence:** LOW (requires adversarial LLM output that passes Zod validation)

The writer constructs a file path from `rule.card.issuer` and `rule.card.id` without sanitization:

```typescript
// MEDIUM RISK: no path sanitization
const issuerDir = join(outputDir, rule.card.issuer);
const filePath = join(issuerDir, `${rule.card.id}.yaml`);
await writeFile(filePath, header + yamlContent, 'utf-8');
```

While `rule.card.issuer` is set to the CLI-provided `--issuer` argument (controlled by the developer), `rule.card.id` comes from LLM-extracted data. If the LLM returns a card ID like `../../etc/cron.d/malicious`, `path.join` would construct a path outside the intended output directory.

**Remediation:** Sanitize path components to prevent traversal:

```typescript
// GOOD: sanitize path components
function sanitizePathComponent(name: string): string {
  // Remove any path separators, dots, and null bytes
  const sanitized = name.replace(/[\/\\:\0]/g, '_').replace(/\.\./g, '');
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new Error(`Invalid path component: "${name}"`);
  }
  return sanitized;
}

const issuerDir = join(outputDir, sanitizePathComponent(rule.card.issuer));
const filePath = join(issuerDir, `${sanitizePathComponent(rule.card.id)}.yaml`);
// Verify the resolved path is still within the output directory
const resolved = resolve(filePath);
if (!resolved.startsWith(resolve(outputDir))) {
  throw new Error(`Path traversal detected: ${filePath}`);
}
```

---

### 7. Error Messages Leak Internal File Paths
**Severity:** MEDIUM
**Category:** A09 — Security Logging and Monitoring Failures (Information Disclosure)
**Location:** `tools/scraper/src/cli.ts:81`, `packages/parser/src/xlsx/index.ts:102`, multiple parser error messages
**Exploitability:** Local, requires triggering an error condition
**Blast Radius:** Disclosure of server directory structure to a developer running the CLI
**Confidence:** HIGH

Several error messages include full filesystem paths:

```typescript
// tools/scraper/src/cli.ts:81
throw new Error(`카드사 "${issuer}" 설정 파일을 찾을 수 없습니다: ${targetFile}`);
// targetFile = /absolute/path/to/tools/scraper/targets/{issuer}.json
```

While this is a developer tool, path leakage in error messages is a security hygiene issue, especially if errors are logged or displayed in shared environments.

**Remediation:** Omit or sanitize paths in error messages:

```typescript
// GOOD: omit full path
throw new Error(`카드사 "${issuer}" 설정 파일을 찾을 수 없습니다. 지원 카드사: hyundai, kb, samsung, ...`);
```

---

## Low Issues (Backlog)

### 8. No File Size Limits in Server-Side Parsers
**Severity:** LOW
**Category:** A04 — Insecure Design
**Location:** `packages/parser/src/xlsx/index.ts:87`, `packages/parser/src/pdf/extractor.ts:5`
**Exploitability:** Local, requires providing a very large file
**Blast Radius:** Memory exhaustion / denial of service
**Confidence:** HIGH

The server-side `parseXLSX` reads the entire file into memory with `readFile(filePath)` without size limits. The web-side parser uses `File.arrayBuffer()` which is bounded by the browser's file handling. The server-side CLI has no such guard.

**Remediation:** Check file size before reading:

```typescript
import { stat } from 'fs/promises';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const { size } = await stat(filePath);
if (size > MAX_FILE_SIZE) {
  return { bank: bank ?? null, format: 'xlsx', transactions: [],
    errors: [{ message: `파일이 너무 큽니다 (${Math.round(size / 1024 / 1024)}MB). 최대 50MB까지 지원합니다.` }] };
}
```

---

### 9. Anthropic API Key Indirectly Revealed in Error Message
**Severity:** LOW
**Category:** A02 — Cryptographic Failures (Sensitive Data Exposure)
**Location:** `packages/parser/src/pdf/llm-fallback.ts:40`
**Exploitability:** Requires triggering the error by parsing a PDF without the env var set
**Blast Radius:** Informational — reveals that `ANTHROPIC_API_KEY` env var is expected
**Confidence:** HIGH

The error message directly references the environment variable name:

```typescript
if (!apiKey) {
  throw new Error('API 키가 설정되지 않아 LLM 폴백을 사용할 수 없습니다.');
  // The error is generic, but line 38 reads: const apiKey = process.env['ANTHROPIC_API_KEY'];
  // Anyone reading the source or a stack trace can see the env var name
}
```

This is a very minor concern since the env var name is conventional and the error message itself does not leak the key value. The key is correctly read from the environment, not hardcoded.

**Remediation:** No action needed — the current implementation is correct. The env var name is already visible in source code which is appropriate for an open-source project.

---

### 10. XSS in Astro define:vars (Dependency CVE)
**Severity:** LOW
**Category:** A03 — Injection (XSS)
**Location:** Dependency — `astro <6.1.6` (GHSA-j687-52p2-xcff)
**Exploitability:** Requires specific conditions — malicious content must be passed through `define:vars` with an incomplete `</script>` tag
**Blast Radius:** XSS in the Astro-generated page
**Confidence:** LOW (specific exploit conditions required)

Astro versions before 6.1.6 have a vulnerability where `define:vars` does not properly sanitize `</script>` tags in variable values, potentially allowing script injection. This is mitigated by the fact that the web app does not use `define:vars` with user-controlled data in the reviewed Astro pages.

**Remediation:** Update Astro to >=6.1.6 (covered by finding #1).

---

## Positive Security Findings (Info)

### P1. No Hardcoded Secrets
No API keys, passwords, or tokens were found in source code. The Anthropic API key is correctly read from `process.env['ANTHROPIC_API_KEY']`. No `.env` files exist in the repository, and `.env`/`.env.*` are in `.gitignore`.

### P2. No `innerHTML`, `{@html}`, or `dangerouslySetInnerHTML` Usage
A grep for all common HTML injection vectors returned zero matches. All user data is rendered through framework-safe template literals (Svelte `{expression}`, Astro `{expression}`), which auto-escape by default.

### P3. Proper HTML Escaping in Report Generator
The `viz/src/report/generator.ts` defines an `esc()` function that properly escapes `&`, `<`, `>`, and `"` in all user-controlled data before embedding it in HTML:

```typescript
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

### P4. LLM Fallback Disabled by Default
The PDF parser's LLM fallback requires explicit opt-in via `--allow-remote-llm` flag. This prevents unintended API key usage and network requests from the default parsing path.

### P5. Client-Side-Only Data Processing
The web app is a static Astro site (`output: 'static'`) that processes all user-uploaded credit card statements entirely in the browser. No data is sent to any server. The home page correctly states: "내 명세서는 밖으로 나가지 않아요. 모든 분석이 브라우저 안에서 끝나요." This is the strongest possible privacy posture for a financial data tool.

---

## Security Checklist

- [x] No hardcoded secrets
- [x] All inputs validated (CSV/XLSX/PDF parsers validate amounts, dates, headers)
- [ ] Injection prevention verified — LLM fallback JSON.parse lacks Zod validation (Finding #4)
- [x] Authentication/authorization — not applicable (static site, no server auth needed)
- [ ] Dependencies audited — 9 HIGH CVEs require updates (Finding #1)
- [x] XSS prevention — no innerHTML/{@html} usage, proper HTML escaping
- [ ] CSP properly configured — 'unsafe-inline' weakens protection (Finding #3)
- [ ] SSRF protection — scraper lacks URL allowlist (Finding #2)
- [x] Privacy — all user data processed client-side only
- [x] Error handling — parser errors are caught and reported, not silently swallowed
- [x] File type validation — upload component validates file types and extensions

---

## OWASP Top 10 Coverage

| Category | Status | Notes |
|----------|--------|-------|
| A01: Broken Access Control | PARTIAL | Scraper path traversal via card ID (Finding #6). Static site has no auth requirements. |
| A02: Cryptographic Failures | PASS | No crypto usage in the app. API keys in env vars. Minor env var name exposure (Finding #9). |
| A03: Injection | PARTIAL | No SQL/command injection (no DB/shell). LLM JSON.parse unvalidated (Finding #4). SessionStorage unvalidated (Finding #5). XSS in Astro dependency (Finding #10). |
| A04: Insecure Design | PARTIAL | No file size limits in server-side parsers (Finding #8). Scraper lacks URL allowlist (Finding #2). |
| A05: Security Misconfiguration | PARTIAL | CSP uses 'unsafe-inline' (Finding #3). Dependency CVEs unpatched (Finding #1). |
| A06: Vulnerable Components | FAIL | 9 HIGH and 4 MODERATE CVEs in dependencies (Finding #1). |
| A07: Auth Failures | N/A | Static site, no authentication. |
| A08: Integrity Failures | PASS | No CI/CD pipeline or update mechanism to tamper with. |
| A09: Logging Failures | PARTIAL | Error messages leak file paths (Finding #7). No security event logging. |
| A10: SSRF | PARTIAL | Scraper fetches arbitrary URLs without allowlist (Finding #2). |
