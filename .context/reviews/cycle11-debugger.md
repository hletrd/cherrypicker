# Cycle 11 — Debugger Findings

**Date:** 2026-05-05
**Reviewer:** debugger (simulated)
**Scope:** Latent bugs, failure modes, edge cases, regressions

## Summary

No new P0-CRITICAL or P1-HIGH bugs found. Cycle 10 Infinity fix is correct and complete. One LOW latent bug surface identified.

---

## Findings

### C11-DB01 — [P0-CRITICAL] Infinity propagation — VERIFIED FIXED

**Files:** All parsers

The `faea6fd` commit added `Number.isFinite(n)` guards to `parseAmountString`, `parseOFXAmount`, and all delegating parsers. Verification:
- `packages/parser/src/csv/shared.ts:161` — `!Number.isFinite(n)` returns `null`
- `packages/parser/src/ofx/index.ts:112` — `!Number.isFinite(n)` returns `null`
- `packages/parser/src/xlsx/index.ts:155,161` — `Number.isFinite` guards
- `packages/parser/src/json/index.ts:81,85` — `Number.isFinite` guards
- `apps/web/src/lib/parser/csv.ts:149` — `!Number.isFinite(parsed)` returns `null`
- `apps/web/src/lib/parser/ofx.ts:80` — `!Number.isFinite(n)` returns `null`
- `apps/web/src/lib/parser/xlsx.ts:312` — `Number.isFinite` guards
- `apps/web/src/lib/parser/json.ts:69,73` — `Number.isFinite` guards

**Status:** VERIFIED FIXED (cycle 10)

---

### C11-DB02 — [LOW] Potential race in store snapshot pattern

**File:** `apps/web/src/lib/store.svelte.ts:515`

`reoptimize` captures `const snapshot = result` at line 515 to avoid reading the reactive `$state` variable during async gaps. However, `snapshot` is a shallow reference to an object with nested mutable arrays (`transactions`, `monthlyBreakdown`). If another async operation mutates these nested arrays before `result = { ...snapshot, ... }` at line 594, the spread could capture mutated state.

**Impact:** Theoretical. No concurrent mutation path exists in current code — `analyze()` and `reoptimize()` are the only writers, and user interaction is single-threaded.

**Fix:** Deep-clone the snapshot if defensive hardening is desired: `const snapshot = JSON.parse(JSON.stringify(result))`.

**Confidence:** Low

---

### C11-DB03 — [LOW] Missing null guard in normalizeAmount for boolean

**File:** `packages/parser/src/json/index.ts:79-88`
**File:** `apps/web/src/lib/parser/json.ts:67-76`

`normalizeAmount` handles `number` and `string` types but not `boolean`. `typeof raw === 'number'` is false for booleans, so they fall through to `return null`. This is technically correct (a boolean is not a valid amount), but could be surprising if a JSON field contains `true`/`false`.

**Impact:** Negligible. `true`/`false` as amount values would indicate malformed data.

---

### C11-DB04 — [LOW] FileDropzone total size check happens after add

**File:** `apps/web/src/components/upload/FileDropzone.svelte:212-216`

The total size check runs after valid files are added to `uploadedFiles`. The warning is shown but files are kept. This is intentional per the comment: "let user proceed."

**Impact:** User can upload >50MB total, causing slow processing. This is a UX choice, not a bug.

---

## Verdict

**SHIP IT** — No latent bugs found. Infinity fix is complete and correct across all parsers.
