# Overall verdict: NOT SAFE YET for high-stakes statement data

This repo has several **real trust-boundary failures** for a credit-card statement analyzer. The biggest issues are: **(1) automatic third-party LLM exfiltration of PDF statement text in the CLI parser, (2) browser execution of third-party remote code while sensitive analysis data is retained in sessionStorage, (3) a vulnerable client-side XLSX parser on attacker-controlled files, and (4) an LLM-to-filesystem path traversal in the scraper tool**. Until these are fixed, I would **not** treat the project as safe for sensitive financial data.

---

## CRITICAL

### 1) PDF parsing can silently exfiltrate statement contents to Anthropic
**Where**
- `packages/parser/src/pdf/index.ts:119-123`
- `packages/parser/src/pdf/llm-fallback.ts:33-52`
- `packages/parser/package.json:11-16`

**What happens**
- When structured PDF parsing fails, `parsePDF()` automatically falls through to `parsePDFWithLLM()`.
- `parsePDFWithLLM()` sends the first ~8000 characters of extracted statement text to Anthropic (`client.messages.create(...)`).
- There is no explicit opt-in, no redaction, no masking, no policy gate, no audit log, and no “air-gapped mode”.

**Why this is critical**
For a credit-card statement analyzer, PDF text frequently contains merchant names, dates, amounts, card details, statement metadata, and sometimes PII. This code turns a local parsing failure into **remote data disclosure**.

**Exploitability**
Low-complexity: any malformed/unusual PDF that defeats the structured parser triggers the network path automatically.

**Impact**
High confidentiality impact. This directly breaks the “local analysis” trust model.

**Mitigations**
- Remove automatic LLM fallback for statement parsing.
- Require an explicit `--allow-remote-llm` flag with a loud privacy warning.
- Redact card/account identifiers before any remote call.
- Add an allowlist of exactly what fields may leave the machine.
- Emit a visible audit event whenever remote inference is used.

---

## HIGH

### 2) The browser executes remote third-party code in the same origin that stores statement results
**Where**
- `apps/web/src/lib/categorizer-ai.ts:80-87`
- `apps/web/src/lib/parser/pdf.ts:226-232`
- `apps/web/src/layouts/Layout.astro:38`

**What happens**
- The app dynamically imports `@huggingface/transformers` from `https://cdn.jsdelivr.net/...`.
- The PDF parser sets `pdfjsLib.GlobalWorkerOptions.workerSrc` to a Cloudflare CDN URL.
- CSP explicitly allows external scripts/workers plus `'unsafe-inline'` and `'unsafe-eval'`.

**Why this matters**
Even if statement files are parsed “locally”, the app is still trusting **remote executable code** inside the same security context that holds analysis results. A CDN compromise, dependency hijack, or hostile injected script gets access to everything the app can read, including parsed transactions in storage.

**Exploitability**
Supply-chain / CDN compromise is not hypothetical in this threat model because the application explicitly grants execution privileges to third-party script and worker origins.

**Impact**
Full confidentiality compromise of uploaded financial data in the browser session.

**Mitigations**
- Bundle all runtime code locally; do not import executable JS from public CDNs at runtime.
- Ship the PDF worker as a same-origin static asset.
- Remove `'unsafe-eval'` and `'unsafe-inline'` from CSP if at all possible.
- Treat model/runtime downloads as build-time artifacts, not live runtime trust decisions.

---

### 3) Sensitive statement data is persisted wholesale in `sessionStorage`
**Where**
- `apps/web/src/lib/store.svelte.ts:83-91`
- `apps/web/src/lib/store.svelte.ts:95-109`
- `apps/web/src/lib/store.svelte.ts:161-175`
- `apps/web/src/lib/store.svelte.ts:184-191`
- `apps/web/src/pages/results.astro:65-79`
- `apps/web/src/pages/report.astro:52-81`
- Privacy claim: `apps/web/src/pages/index.astro:37-38`

**What happens**
- The full `AnalysisResult` is serialized into `sessionStorage`.
- That includes transaction-level merchant/date/amount/category data.
- Multiple pages read the stored object and rebuild views from it.

**Why this matters**
`sessionStorage` is accessible to any script running on the origin. In this repo, same-origin execution already includes inline scripts, remote runtime imports, and remote workers via permissive CSP. That means one XSS or supply-chain event turns persistent in-tab financial history into easy exfiltration.

**Exploitability**
Straightforward after any same-origin script execution bug or dependency compromise.

**Impact**
High confidentiality impact; sensitive financial records remain resident longer than necessary.

**Mitigations**
- Do not persist raw transactions in web storage.
- Keep sensitive analysis data in memory only.
- If persistence is required, encrypt client-side with a user-provided passphrase and auto-expire aggressively.
- Add a “clear analysis data” control and clear storage on navigation/idle timeout.
- Change the homepage privacy copy until the storage/network model is actually true.

---

### 4) Client-side XLSX parsing uses a version with a known prototype-pollution advisory on attacker-controlled files
**Where**
- `apps/web/package.json:21-24`
- `apps/web/src/lib/parser/xlsx.ts:1`
- `apps/web/src/lib/parser/xlsx.ts:97-109`
- `apps/web/src/lib/parser/xlsx.ts:147-249`

**What happens**
- The browser app depends on `xlsx@^0.18.5` and uses it to parse user-supplied `.xlsx/.xls` files in the browser.

**Why this matters**
This is directly in the attacker-controlled file path. Current GitHub advisory `GHSA-4r6h-8v6p-xvw6` says `xlsx < 0.19.3` is affected by prototype pollution when reading specially crafted files.

**Exploitability**
User only has to open a malicious spreadsheet in the web UI.

**Impact**
Prototype pollution in a browser app can corrupt logic, poison object lookups, bypass assumptions, and amplify any downstream DOM/rendering bugs. In this app, it is especially dangerous because the same page also retains sensitive statement data.

**Mitigations**
- Stop using `xlsx@0.18.5` in the browser path.
- Upgrade to a non-vulnerable distribution and pin it explicitly.
- Parse untrusted spreadsheet files in a hardened worker or isolated sandbox, not the main UI context.
- Add size/type guards before parsing.

**External reference**
- GitHub Advisory Database: `GHSA-4r6h-8v6p-xvw6` / CVE-2023-30533.

---

### 5) Scraper has an LLM-to-filesystem path traversal primitive
**Where**
- `tools/scraper/src/extractor.ts:23-31`
- `tools/scraper/src/prompts/schemas.ts:8-32`
- `tools/scraper/src/writer.ts:14-18`

**What happens**
- Untrusted page content is sent to an LLM.
- The returned `rule.card.id` is only typed as a string; there is no path-safe regex/policy enforcement in the schema or validator.
- `writeCardRule()` uses `join(issuerDir, \
`${rule.card.id}.yaml`\)` directly.

**Why this matters**
A prompt-injected card page can coerce the model to emit IDs like `../../../../somewhere/evil`, and `path.join()` will happily traverse out of the intended directory. Because the scraper writes files to disk, this becomes an arbitrary file write primitive within the user’s permissions.

**Exploitability**
Realistic if the scraped page is attacker-controlled, compromised, or includes hostile content. This tool explicitly ingests untrusted HTML and trusts LLM output derived from it.

**Impact**
High integrity impact: overwrite or plant files outside the intended rules directory.

**Mitigations**
- Enforce strict path-safe regex validation for `card.id` (e.g. `^[a-z0-9-]+$`).
- Resolve and verify that the final output path stays within `outputDir`.
- Reject absolute paths, `..`, slashes, backslashes, and control characters.
- Treat all LLM output as untrusted input.

---

## MEDIUM

### 6) Scraper can fetch arbitrary URLs with no issuer-domain allowlist
**Where**
- `tools/scraper/src/cli.ts:32-37`
- `tools/scraper/src/cli.ts:90-99`
- `tools/scraper/src/fetcher.ts:10-18`
- `tools/scraper/src/fetcher.ts:42-44`

**What happens**
- `--url` fully overrides the target URL.
- No scheme restrictions, no hostname allowlist, no blocklist for internal IPs, no redirect policy, and no timeout.

**Why this matters**
This turns the scraper into a generic fetch primitive from the machine running it. In CI, corporate networks, or developer laptops, that can become SSRF against internal admin endpoints, metadata services, or intranet apps.

**Exploitability**
Requires someone to run the tool with a malicious URL, but the code provides no guardrails despite the tool being intended for known public issuer pages.

**Impact**
Internal network probing / unintended access; possible secondary credential or metadata exposure depending on environment.

**Mitigations**
- Restrict `--url` to HTTPS and issuer-owned domains unless an explicit dangerous override is enabled.
- Disable redirects or validate redirect destinations.
- Add request timeouts and max response size.
- Reject localhost, link-local, RFC1918, and cloud metadata IP ranges by default.

---

### 7) No file-size / page-count / row-count limits on hostile local inputs
**Where**
- `apps/web/src/components/upload/FileDropzone.svelte:63-69`
- `apps/web/src/components/upload/FileDropzone.svelte:105-130`
- `apps/web/src/lib/parser/index.ts:19-20`
- `apps/web/src/lib/parser/index.ts:43-48`
- `apps/web/src/lib/parser/xlsx.ts:97-109`
- `apps/web/src/lib/parser/pdf.ts:220-243`
- `packages/parser/src/index.ts:33-55`
- `packages/parser/src/pdf/extractor.ts:4-7`

**What happens**
- The UI accepts CSV/XLSX/XLS/PDF with no size cap.
- Parsers read entire files into memory.
- PDF parsing iterates every page; XLSX parsing opens whole workbooks.

**Why this matters**
Malformed or oversized PDFs/XLSX files can easily become local DoS inputs (memory exhaustion, CPU spikes, frozen tabs, CLI crashes). For a “drop your statement here” flow, this is a practical abuse case.

**Exploitability**
Easy: give the user a huge or zip-bomb-like file that still passes extension/type checks.

**Impact**
Availability loss; possible browser tab crash or CLI resource exhaustion.

**Mitigations**
- Add hard limits for file size, page count, row count, and parse time.
- Parse in workers / subprocesses with resource ceilings.
- Fail closed on suspicious compression ratios or workbook dimensions.

---

### 8) Privacy posture is overstated relative to actual behavior
**Where**
- `apps/web/src/pages/index.astro:37-38`
- `apps/web/src/layouts/Layout.astro:38`
- `apps/web/src/lib/store.svelte.ts:87-91`
- `apps/web/src/lib/categorizer-ai.ts:80-87`

**What happens**
The UI claims: “내 명세서는 밖으로 나가지 않아요. 모든 분석이 브라우저 안에서 끝나요.” (“My statement never leaves the browser. All analysis finishes in the browser.”)

**Why this matters**
That statement is too strong for the current implementation. Even if raw statement bytes are not intentionally POSTed by the web UI, the app still:
- executes third-party remote code at runtime,
- downloads model/runtime assets from third parties,
- keeps parsed financial data in `sessionStorage`.

This is a trust problem, not just a marketing nit.

**Mitigations**
- Narrow the claim immediately.
- Only restore the stronger claim after removing remote runtime execution and storage persistence risks.

---

## LOW

### 9) `{@html}` and `innerHTML` are present; currently constrained, but they raise future XSS blast radius
**Where**
- `apps/web/src/components/ui/Icon.svelte:44-56`
- `apps/web/src/pages/report.astro:49-81`

**Assessment**
I do **not** see a directly exploitable XSS here today because the icon SVG fragments are hardcoded and the report page escapes string fields before insertion. Still, given the already-permissive CSP and sensitive data model, these patterns should be treated as dangerous debt.

**Mitigations**
- Prefer DOM construction or framework rendering over `innerHTML`/`{@html}`.
- Keep all string escaping centralized and tested.

---

## Recommended hardening order
1. **Delete automatic remote LLM fallback for statement parsing** or gate it behind explicit opt-in.
2. **Remove runtime third-party executable imports/workers** from the web app.
3. **Stop storing full analysis results in `sessionStorage`.**
4. **Replace vulnerable browser-side `xlsx` usage** with a safer, patched, isolated parsing path.
5. **Fix scraper path traversal** by validating `card.id` and constraining final output paths.
6. Add **strict input-size limits** for CSV/XLSX/PDF everywhere.
7. Tighten CSP and remove `'unsafe-inline'` / `'unsafe-eval'` if feasible.

## Bottom line
The repo shows good intent around local-first UX, but the current implementation still has **multiple high-severity ways to leak, corrupt, or over-trust sensitive data paths**. The main blockers are the **automatic Anthropic PDF fallback**, **runtime third-party code execution**, **browser storage of full statement analysis**, and **unsafe filesystem trust in scraper output**.
