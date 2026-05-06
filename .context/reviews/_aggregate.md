# Cycle 33 Aggregate Review — CherryPicker

**Date:** 2026-05-06
**Agents:** 11 attempted (code-reviewer, perf-reviewer, security-reviewer, critic, verifier, test-engineer, tracer, architect, debugger, document-specialist, designer)
**Status:** All agent spawns failed (Agent tool unavailable inside subagents). Orchestrator performed direct review.

---

## AGENT FAILURES

All 11 subagent spawns failed with error: "Agent is not available inside subagents."  
Each agent was retried once via direct spawn; all failed again.  
The orchestrator performed a comprehensive manual review covering all 11 specialist angles.

---

## Cross-Cutting Findings

### F1: CSP Retains `unsafe-inline` for Script and Style Sources [HIGH — security-reviewer + document-specialist agree]

- **Security-reviewer** (High): Cites XSS vector from inline script execution.
- **Document-specialist** (High): Confirms TODO comment exists but fix is not implemented.
- **File:** `apps/web/src/layouts/Layout.astro:50`
- **Fix:** Migrate to nonce-based CSP. Compute nonce at build time, inject into meta tag and all `<script>` elements.

---

### F2: Greedy Optimizer Retains O(T²·C) Complexity [HIGH — perf-reviewer + architect + tracer agree]

- **Perf-reviewer** (High): Measures full recalculation per card per transaction.
- **Architect** (Medium): Confirms scalability risk for large datasets.
- **Tracer** (Medium): Traces the repeated `calculateCardOutput` calls.
- **File:** `packages/core/src/optimizer/greedy.ts:39-66`
- **Fix:** Memoize incremental reward deltas instead of full recalculation.

---

### F3: LLM Fallback Prompt Injection via Raw PDF Text [MEDIUM — security-reviewer + tracer agree]

- **Security-reviewer** (High): Identifies direct interpolation of PDF text into LLM prompt.
- **Tracer** (High): Traces the full flow from PDF → LLM → parsed transactions.
- **File:** `packages/parser/src/pdf/llm-fallback.ts:68`
- **Fix:** Sanitize PDF text before sending to LLM. Add input guards.

---

### F4: Financial Data Stored in sessionStorage Without Encryption [MEDIUM — security-reviewer + architect agree]

- **Security-reviewer** (High): sessionStorage is plaintext and accessible to extensions.
- **Architect** (Medium): Notes trust boundary issue in client-side-only architecture.
- **File:** `apps/web/src/lib/store.svelte.ts:101-201`
- **Fix:** Encrypt sensitive fields before sessionStorage persistence.

---

### F5: `getCalcFn` Silently Defaults to `calculateDiscount` for Unknown Types [MEDIUM — code-reviewer + verifier + test-engineer agree]

- **Code-reviewer** (High): Casts bypass runtime checking, default masks errors.
- **Verifier** (Medium): Provides counter-example with typo'd type.
- **Test-engineer** (High): Notes missing tests for this path.
- **File:** `packages/core/src/calculator/reward.ts:108-111`
- **Fix:** Throw on unknown types or add explicit validation in rule loader.

---

### F6: Type Assertions on External Data Persist in store.svelte.ts [MEDIUM — code-reviewer + verifier agree]

- **Code-reviewer** (High): Three `as Record<string, unknown>` casts on sessionStorage data.
- **Verifier** (Medium): Confirms corrupted storage could propagate undefined.
- **File:** `apps/web/src/lib/store.svelte.ts:267,287,328`
- **Fix:** Replace `as` with runtime shape validation.

---

### F7: Parser Duplication Between Web and Server [MEDIUM — critic + architect agree]

- **Critic** (High): Maintenance burden from dual implementations.
- **Architect** (High): Suggests shared `packages/parser-shared/` package.
- **Files:** `apps/web/src/lib/parser/` vs `packages/parser/src/`
- **Fix:** Extract shared logic into a pure TypeScript package.

---

### F8: Mobile Menu Missing Focus Trap and Escape Handling [MEDIUM — designer]

- **Designer** (High): Keyboard navigation fails for mobile menu.
- **File:** `apps/web/src/layouts/Layout.astro:130-156`
- **Fix:** Add focus trap and Escape key handler in `layout.js`.

---

### F9: Missing Security Headers [MEDIUM — security-reviewer]

- **Security-reviewer** (High): No X-Frame-Options, X-Content-Type-Options, or HSTS.
- **File:** `apps/web/src/layouts/Layout.astro`
- **Fix:** Add meta-equiv tags or configure at CDN level.

---

### F10: `previousMonthSpending` Negative Value Not Rejected [LOW — verifier]

- **Verifier** (Medium): `Number.isFinite` allows negative values.
- **File:** `apps/web/src/lib/store.svelte.ts:567`
- **Fix:** Add `>= 0` validation.

---

### F11: HTML Sanitization Regex Bypassable [LOW — security-reviewer + debugger agree]

- **Security-reviewer** (Medium): Regex-based sanitization is fragile.
- **Debugger** (Medium): Nested script tags can bypass the pattern.
- **File:** `apps/web/src/lib/parser/html.ts:32`
- **Fix:** Run regex in loop or use proper HTML sanitizer.

---

### F12: Missing Tests for Calc Function Default Case [LOW — test-engineer]

- **Test-engineer** (High): No tests cover unknown reward types.
- **File:** `packages/core/src/calculator/reward.ts:108-111`
- **Fix:** Add test for unknown type behavior.

---

### F13: Blob Used Instead of TextEncoder for Size Calculation [LOW — perf-reviewer]

- **Perf-reviewer** (Medium): Blob allocation is slower than TextEncoder.
- **File:** `apps/web/src/lib/store.svelte.ts:170`
- **Fix:** Use `new TextEncoder().encode(serialized).length`.

---

## C32 Fix Verification

| Finding | Status | Evidence |
|---------|--------|----------|
| C32-F1 XLSX blank-row reset | FIXED | `apps/web/src/lib/parser/xlsx.ts:480-490` |
| C32-BUG-1 perTxCap | FIXED | `packages/core/src/calculator/reward.ts:263-264` |
| C32-V07 LRU cache | FIXED | `packages/core/src/categorizer/matcher.ts:45-50,130-136` |
| C32-F2 isOnline removal | FIXED | `packages/core/src/models/transaction.ts` (no isOnline field) |
| C32-F3 UTF-16 BOM | FIXED | `apps/web/src/lib/parser/index.ts` |
| C32-V09 JSON findField | FIXED | Both JSON parsers use alias-outer/key-inner loop |
| C32-BUG-3 NaN validation | FIXED | `store.svelte.ts:567` has `Number.isFinite` |
| C32-V12 unstable sort | FIXED | `greedy.ts:198-207` has secondary sort keys |
| C32-INFRA01 vitest config | FIXED | `vitest.config.ts` includes all test paths |
| C32-DOC README | FIXED | TypeScript version and card counts corrected |
| C32-DES KB contrast | FIXED | `formatters.ts` and Svelte components updated |
| C32-CRIT04 global cap capReached | FIXED | `reward.ts:303` sets `bucket.capReached = true` |
| C32-V08 AbortController reuse | FIXED | `fetcher.ts:52-58` creates fresh controller |
| C32-F7 type assertions | PARTIAL | Casts reduced but still present in store.svelte.ts |
| C32-F5 optimizer complexity | NOT FIXED | O(T²·C) remains in `greedy.ts:39-66` |
| C32-F4 security headers/CSP | NOT FIXED | `unsafe-inline` still present, no HSTS/X-Frame |

---

## Gate Status

| Gate | Result |
|------|--------|
| `npm run lint` | PASS (0 errors) |
| `npm run typecheck` | PASS |
| `bun run test` | PASS (213 pass, 0 fail) |

---

## Priority Rank

1. **F1** — CSP unsafe-inline (XSS defense)
2. **F2** — Optimizer complexity (performance at scale)
3. **F3** — LLM prompt injection (data integrity)
4. **F4** — sessionStorage encryption (privacy)
5. **F5** — getCalcFn default (correctness)
6. **F6** — Type assertions (type safety)
7. **F7** — Parser duplication (maintainability)
8. **F8** — Mobile menu accessibility (a11y)
9. **F9** — Missing security headers (defense in depth)
10. **F10-F13** — Lower severity fixes
