# Verifier Review — cherrypicker (Cycle 19)

**Reviewer:** verifier
**Scope:** Evidence-based correctness check against stated behavior
**Date:** 2026-05-06

---

## Summary

Verified cycle 18 fixes and checked behavioral claims in comments against code reality. One claim is contradicted by the code.

---

## Findings

### C19-VER01 [MEDIUM] — Comment claims C1-01 supports both gross and net spending

**Files:** `analyzer.ts:327-332`, `store.svelte.ts:498-519`
**Confidence:** High

Both functions cite C1-01 but implement opposite behaviors:
- `analyzer.ts`: "Only positive amounts (purchases) for monthlySpending. Korean card issuers define 전월실적 as gross spending, not net."
- `store.svelte.ts`: "Accumulate all non-zero amounts for monthlySpending. Refunds (negative amounts) reduce the net spending total, which is the convention most Korean card companies use for 전월실적."

One of these comments is wrong. Empirically, Korean card companies define 전월실적 as the total of approved transactions (gross), excluding refunds. The `analyzer.ts` comment is correct; the `store.svelte.ts` comment and implementation are wrong.

**Fix:** Update `reoptimize` to use gross spending (`tx.amount > 0`) and correct the comment.

---

### C19-VER02 [LOW] — `parseOFXAmount` comment claims rounding but web version doesn't round

**File:** `apps/web/src/lib/parser/ofx.ts:75-82`
**Confidence:** Low

The server-side `parseOFXAmount` rounds: `return Math.round(n);`
The web-side version also rounds: `return Math.round(n);`
Both are consistent. Verified.

---

### C19-VER03 [LOW] — `normalizeHTML` claims parity between server and web

**Files:** `packages/parser/src/csv/shared.ts:180-183` vs `apps/web/src/lib/parser/html.ts:28-30`
**Confidence:** High

Byte-for-byte identical regex patterns. Verified.

---

## Verdict

**FIX AND SHIP** — C19-VER01 is a verified behavioral mismatch.
