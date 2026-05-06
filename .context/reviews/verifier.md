# Verifier — CherryPicker (Cycle 32)

**Reviewer:** verifier
**Scope:** Evidence-based correctness check across all source, test, and parser files
**Date:** 2026-05-06

---

## Summary

Verification of 14 critical claims across correctness, parity, security, and data-flow paths. Five confirmed issues (3 HIGH, 5 MEDIUM, 4 LOW). Two invariants holding. All gates pass (lint, typecheck, test).

---

## Verified Claims

### C32-V01: XLSX Blank-Row Handling Parity with HTML Parser

**Status:** BROKEN — HIGH
**Files:** `apps/web/src/lib/parser/xlsx.ts:480` vs `apps/web/src/lib/parser/html.ts:163-173`
**Evidence:** HTML parser resets `lastDate`, `lastMerchant`, `lastAmount`, etc. on blank rows. XLSX parser only `continue`s without resetting. This breaks the invariant that blank rows terminate forward-fill scope. A blank row followed by a new transaction may incorrectly forward-fill from the *previous* section rather than the *current* section.
**Fix:** Reset forward-fill state in xlsx.ts before `continue`.

---

### C32-V02: `isOnline` Is Never Populated

**Status:** CONFIRMED — HIGH
**Files:** `apps/web/src/lib/parser/types.ts`, `apps/web/src/lib/analyzer.ts:91-103`, `packages/core/src/calculator/reward.ts:36-51`
**Evidence:** `RawTransaction` has no `isOnline` field. `CategorizedTx.isOnline` is declared optional but never assigned anywhere in the parser or analyzer pipeline. `ruleConditionsMatch` at `reward.ts:36-51` evaluates `excludeOnline && tx.isOnline` — because `isOnline` is always `undefined` (falsy), this branch is unreachable. The optimizer silently ignores all `excludeOnline` rules, meaning online transactions get rewards they should not.
**Fix:** Remove `excludeOnline` from schema + calculator, or implement merchant-based online detection.

---

### C32-V03: Web Encoding Lacks UTF-16 Support

**Status:** BROKEN — MEDIUM
**Files:** `apps/web/src/lib/parser/index.ts:26-62` vs `packages/parser/src/detect.ts:9-47`
**Evidence:** Server-side `detectEncoding` checks UTF-16 LE/BE BOMs (`0xFF 0xFE` / `0xFE 0xFF`). Web-side `parseFile` only tries `['utf-8', 'cp949']` via `TextDecoder`. No fallback for UTF-16 BOM. A UTF-16-encoded bank statement would silently parse as garbage on the web but work on the server.
**Fix:** Add BOM sniffing to web-side `parseFile` before the encoding trial.

---

### C32-V04: All Parsers Use Consistent Amount Normalization

**Status:** HOLDING
**Evidence:** CSV, XLSX, PDF, HTML, JSON, and OFX parsers all delegate to `parseAmountString` (or `parseAmount` wrapper) which handles full-width digits, parentheses, Won signs, KRW prefix, and `마이너스`. Server and web paths use the same normalization logic. Verified by tracing imports: all paths lead to `packages/parser/src/csv/shared.ts:140-174`.

---

### C32-V05: Date Validation Is Consistent Across Parsers

**Status:** HOLDING
**Evidence:** All parsers use `parseDateStringToISO` followed by `isValidISODate`. The regex and fallback logic (`dateRaw.replace(/[^0-9].*$/, '').slice(0, 8)`) are identical in web and server paths. Verified across `csv/generic.ts`, `xlsx/index.ts`, `json/index.ts`, `ofx/index.ts`, and web equivalents.

---

### C32-V06: Type Assertions Bypass Runtime Checks

**Status:** BROKEN — MEDIUM
**Files:** `apps/web/src/lib/store.svelte.ts:223,267,287,328`, `apps/web/src/lib/tx-validation.ts:10`, `apps/web/src/lib/parser/json.ts:176,182,189,216`, `apps/web/src/lib/parser/pdf.ts:479`
**Evidence:** Twelve `as` casts with no accompanying runtime validation. If external data changes shape (e.g., PDF transform matrix is not an array, JSON field is not a string), the cast produces `undefined` or garbage that propagates silently. Example: `pdf.ts:479` casts `item.transform` as `number[]` — if pdfjs-dist returns a Float32Array or different structure, `transform[4]` and `transform[5]` (x,y coordinates) will be `undefined`, corrupting text positioning.
**Fix:** Replace with validated extraction helpers or runtime `Array.isArray` checks.

---

### C32-V07: MerchantMatcher Cache Claims LRU but Uses FIFO

**Status:** CONFIRMED — HIGH
**Files:** `packages/core/src/categorizer/matcher.ts:15-20`, `packages/core/src/categorizer/matcher.ts:125-130`
**Evidence:** The code declares `MAX_CACHE_SIZE = 500` and documents an LRU cache. However, eviction uses `this.cache.keys().next().value`, which evicts the *first-inserted* entry (FIFO), not the *least-recently-used* entry. For workloads with >500 unique merchants, this causes unnecessary cache misses and repeated taxonomy scans, degrading performance. The bug is in the eviction logic at lines 128-130.
```typescript
// matcher.ts:128-130 (FIFO, not LRU)
if (this.cache.size >= MAX_CACHE_SIZE) {
  this.cache.delete(this.cache.keys().next().value);
}
```
**Fix:** Use a proper LRU with `Map` by deleting+re-setting on access, or use a real LRU implementation.

---

### C32-V08: Scraper Fetcher Reuses AbortController Across Two Fetches

**Status:** CONFIRMED — MEDIUM
**Files:** `tools/scraper/src/fetcher.ts:38-76`
**Evidence:** `fetchCardPage` creates one `AbortController` and uses it for the initial `fetch`. If the response is EUC-KR encoded, it calls `fetch(url)` a *second time* with a *new* `fetch` but the *same* `AbortController` signal. If the first fetch's timeout fires between the two fetches, the second fetch is also aborted. More subtly, the second fetch shares the timeout state of the first, which may have already been partially consumed.
```typescript
// fetcher.ts:38-76 — controller reused for second fetch
const controller = new AbortController();
const res = await fetch(url, { signal: controller.signal, ... });
// ... EUC-KR detected ...
const res2 = await fetch(url, { signal: controller.signal, ... }); // SAME controller
```
**Fix:** Create a fresh `AbortController` for the second fetch, or abort the first controller before starting the second.

---

### C32-V09: JSON Parser findField Uses Non-Deterministic Object.keys Order

**Status:** CONFIRMED — MEDIUM
**Files:** `packages/parser/src/json/index.ts:195-216`, `apps/web/src/lib/parser/json.ts:195-216`
**Evidence:** `findField` iterates over `Object.keys(obj)` to find case-insensitive field matches. Per the ECMAScript spec, `Object.keys` order is: integer indices in ascending order, then string keys in insertion order. For JSON objects (which typically have string keys), this means the match depends on the *insertion order* of fields in the input JSON. Two JSON files with the same fields in different order may match different aliases (e.g., `date` vs `transactionDate`), producing inconsistent parse results. This is especially problematic for user-uploaded JSON where field order is not guaranteed.
**Fix:** Sort keys before iteration, or use a deterministic priority order for aliases.

---

### C32-V10: OFX parseOFXAmount Accepts Non-OFX Amount Formats

**Status:** BROKEN — MEDIUM
**Files:** `packages/parser/src/ofx/index.ts:122-125`, `packages/parser/src/csv/shared.ts:140-174`
**Evidence:** `parseOFXAmount` delegates directly to `parseAmountString`, which handles full-width digits, Won signs (`₩/￦`), `원` suffix, `KRW` prefix, `마이너스` prefix, and parenthesized negatives. OFX 1.x/2.x specifies amounts as plain decimal strings (e.g., `-15000.00`). The extra normalization is harmless for valid OFX but means malformed OFX amounts that happen to match Korean patterns (e.g., `KRW 15000`) are silently accepted instead of rejected. This masks data quality issues in OFX files.
**Fix:** Consider adding an OFX-specific strict mode, or at least document that OFX parser accepts extended formats.

---

### C32-V11: parseAmountString Allows Trailing Non-Digit Characters After Numeric Prefix

**Status:** BROKEN — LOW
**Files:** `packages/parser/src/csv/shared.ts:165-170`
**Evidence:** The regex `/^[+-]?\d+(?:\.\d+)?/` extracts a leading numeric prefix, then checks if the *remaining* characters contain digits or dots. However, it allows trailing non-digit characters like `123abc` → parses as `123`, or `1000원` → parses as `1000` (the `원` was already stripped earlier). The comment says "Allow trailing non-digits" but this is overly permissive. A malformed amount like `1,000ABC` would parse as `1000` after comma stripping.
**Fix:** Reject trailing alphabetic characters after the numeric prefix, or tighten the allowed suffix set.

---

### C32-V12: Greedy Optimizer Uses Unstable Sort

**Status:** RISK — LOW
**Files:** `packages/core/src/optimizer/greedy.ts:50-55`
**Evidence:** `transactions.sort((a, b) => b.amount - a.amount)` is an unstable sort in V8 (JavaScript's `sort` is not guaranteed stable). Transactions with equal amounts may reorder non-deterministically across runs. Since the greedy algorithm's marginal reward depends on previous assignments, equal-amount transactions could be assigned to different cards in different runs, producing inconsistent recommendations.
**Fix:** Add a secondary sort key (e.g., merchant name, date, or original index) to guarantee deterministic ordering.

---

### C32-V13: normalizeHTML Does Not Handle All XSS Vectors

**Status:** RISK — LOW
**Files:** `packages/parser/src/csv/shared.ts:192-210`, `apps/web/src/lib/parser/html.ts:45-63`
**Evidence:** `normalizeHTML` strips `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, event handlers, and `javascript:` URLs. However, it does not handle: (1) `data:` URLs in href/src (could execute JavaScript via `data:text/html,<script>...`), (2) `<form action="javascript:...">`, (3) CSS expression attacks in inline styles, (4) `<meta refresh>` with JS URLs, (5) `<svg onload=...>` (SVG tags are not stripped). The function is used defensively before SheetJS parsing, not for actual rendering, but if the normalized HTML is ever displayed, these vectors remain active.
**Fix:** Also strip `data:` URLs and inline `style` attributes, or use a proper HTML sanitizer like DOMPurify.

---

### C32-V14: store.svelte.ts reoptimize Does Not Preserve Manual Card Assignment Overrides

**Status:** RISK — LOW
**Files:** `apps/web/src/lib/store.svelte.ts:500-635`
**Evidence:** The `reoptimize` method recalculates the optimal card assignment from scratch using the greedy optimizer. It does NOT preserve any manual overrides the user may have made in the UI (e.g., forcing a specific card for a transaction). The comment at line 504 says "Recompute optimal assignment from scratch" which is intentional, but there's no way for the UI to mark an override as sticky across reoptimizations. After the user edits a transaction or adds a new file, all manual assignments are lost.
**Fix:** Add a `manualAssignment` field to transactions in the store, and have `reoptimize` respect it.

---

## Cross-File Interaction Risks

### R1: Web/Server Parser Parity Gaps

Multiple parsers have separate web and server implementations with subtle behavioral differences:

| Feature | Server | Web | Risk |
|---------|--------|-----|------|
| UTF-16 encoding | Supported (`detect.ts:9-47`) | Not supported (`index.ts:26-62`) | C32-V03 |
| XLSX blank-row reset | Reset (`html.ts:163-173`) | Missing (`xlsx.ts:480`) | C32-V01 |
| PDF LLM fallback | Supported (`llm-fallback.ts:1-154`) | Not supported | Web PDF parsing fails silently for complex PDFs |
| JSON field order | Non-deterministic (`Object.keys`) | Same | C32-V09 |

**Recommendation:** Consolidate parser logic into shared packages with platform-agnostic entry points, or add a parity test suite that feeds identical inputs to both paths and compares outputs.

### R2: Category Label Collision

**Files:** `apps/web/src/lib/category-labels.ts:15-20`
**Evidence:** The label map sets both `sub.id` and `${node.id}.${sub.id}` as keys. If a leaf category ID collides with a top-level category ID (e.g., `sub.id = "dining"` and `node.id = "dining"`), the `${node.id}.${sub.id}` key (`dining.dining`) shadows the leaf key. While current taxonomy may avoid collisions, this is not enforced by schema.
**Fix:** Validate no leaf ID equals any top-level ID during YAML loading.

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | PASS (0 errors, 0 warnings, 2 hints) |
| `npm run typecheck` | PASS |
| `bun run test` | PASS (213 pass, 0 fail) |

---

## Verdict

**FIX BEFORE SHIP:**
- C32-V01 (XLSX forward-fill leak) — invariant violation, data corruption risk
- C32-V02 (isOnline dead code) — silent incorrect reward calculation
- C32-V07 (FIFO cache eviction) — performance degradation, incorrect LRU semantics

**FIX RECOMMENDED:**
- C32-V03 (UTF-16 web gap) — cross-platform parity failure
- C32-V06 (type assertions) — runtime safety
- C32-V08 (scraper AbortController reuse) — race condition in fetcher
- C32-V09 (JSON non-deterministic matching) — inconsistent parse results
- C32-V10 (OFX amount laxness) — data quality masking

**RISK — MONITOR:**
- C32-V11 (trailing non-digit amounts) — over-permissive parsing
- C32-V12 (unstable sort) — non-deterministic optimization
- C32-V13 (HTML normalization gaps) — XSS if HTML ever rendered
- C32-V14 (manual override loss) — UX regression on reoptimization
- R2 (category label collision) — taxonomy schema gap
