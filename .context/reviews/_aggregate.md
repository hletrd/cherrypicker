# Cycle 34 Aggregate Review — CherryPicker

**Date:** 2026-05-06
**Agents:** 6 specialist angles (code-reviewer, security-reviewer, architect, perf-reviewer, test-engineer, verifier)
**Status:** Manual review (Agent tool unavailable inside subagents). Orchestrator performed direct review covering all angles.

---

## AGENT FAILURES

None — all 6 review angles covered by orchestrator directly.

---

## Verified Fixed Since Cycle 33

| Finding | File | Evidence |
|---------|------|----------|
| C33-F3 LLM prompt injection | `packages/parser/src/pdf/llm-fallback.ts:7-25` | `sanitizeLLMInput()` removes injection patterns |
| C33-F5 getCalcFn default | `packages/core/src/calculator/reward.ts:110` | Throws on unknown type; test at `:775` |
| C33-F6 Type assertions | `apps/web/src/lib/store.svelte.ts` | `isPlainObject()` replaces all casts |
| C33-F8 Mobile menu a11y | `apps/web/public/scripts/layout.js:46-96` | Focus trap, Escape, `inert` attribute |
| C33-F9 Security headers | `apps/web/src/layouts/Layout.astro:52-53` | X-Frame-Options, X-Content-Type-Options added |
| C33-F10 previousMonthSpending negative | `apps/web/src/components/upload/FileDropzone.svelte:295` | Rejects `raw < 0` |
| C33-F11 HTML sanitization | `apps/web/src/lib/parser/html.ts:33-35` | Loop-based script stripping |
| C33-F12 Missing calc test | `packages/core/__tests__/calculator.test.ts:775` | `.toThrow(/Unknown reward type/)` |
| C33-F13 Blob→TextEncoder | `apps/web/src/lib/store.svelte.ts:177` | `new TextEncoder().encode(...).length` |

---

## Still Not Fixed (carried forward)

### F1: CSP Retains `unsafe-inline` [HIGH — security-reviewer + document-specialist agree]
- **File:** `apps/web/src/layouts/Layout.astro:50`
- **Fix:** Migrate to nonce-based CSP.

### F2: Greedy Optimizer O(T*C) Complexity [HIGH — perf-reviewer + architect + tracer agree]
- **File:** `packages/core/src/optimizer/greedy.ts:39-66`
- **Fix:** Memoize incremental reward deltas.

### F4: Financial Data in sessionStorage Without Encryption [MEDIUM — security-reviewer + architect agree]
- **File:** `apps/web/src/lib/store.svelte.ts:100-106`
- **Fix:** Encrypt sensitive fields.

### F7: Parser Duplication Between Web and Server [MEDIUM — critic + architect agree]
- **Files:** `apps/web/src/lib/parser/` vs `packages/parser/src/`
- **Fix:** Extract shared logic.

---

## New Cross-Cutting Findings

### C34-N1: Silent Reward Type Fallback to 'discount' [MEDIUM — code-reviewer + verifier agree]

- **Code-reviewer** (High): Unknown reward types silently coerced to 'discount'.
- **Verifier** (Medium): Confirmed fail-open behavior in adapter.
- **File:** `apps/web/src/lib/analyzer.ts:71-73`
- **Code:**
  ```ts
  type: VALID_REWARD_TYPES.has(r.type)
    ? (r.type as 'discount' | 'points' | 'cashback' | 'mileage')
    : 'discount' as const,
  ```
- **Problem:** Unrecognized reward types produce incorrect calculations without warning.
- **Fix:** Throw on unknown reward type in adapter.

---

### C34-N2: API Key Regex Too Restrictive [LOW — security-reviewer]

- **File:** `packages/parser/src/pdf/llm-fallback.ts:66`
- **Code:** `!/^sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{30,}$/.test(apiKey)`
- **Problem:** Only matches exactly 2 digits. `api100` or longer versions rejected.
- **Fix:** Use `[0-9]+` for version segment.

---

### C34-N3: Silent Card Source Fallback [LOW — code-reviewer]

- **File:** `apps/web/src/lib/analyzer.ts:65-67`
- **Problem:** Unknown `card.source` silently mapped to `'web'`.
- **Fix:** Warn on unknown source.

---

## Coverage Gaps

- G1: No test for analyzer adapter fallback behavior (C34-N1).
- G2: No test verifying security header rendering.
- G3: Empty migrations registry untested.

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
3. **C34-N1** — Silent reward type fallback (correctness)
4. **F4** — sessionStorage encryption (privacy)
5. **F7** — Parser duplication (maintainability)
6. **C34-N2** — API key regex (future-proofing)
7. **C34-N3** — Card source fallback (data quality)
8. **G1-G3** — Test coverage gaps
