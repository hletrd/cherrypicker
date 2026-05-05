# Cycle 7 Debugger Review

**Date:** 2026-05-05
**Scope:** Latent bugs, failure modes, edge cases in Cycle 6 fixes
**Reviewer:** debugger

---

## Summary

Cycle 6 fixes resolved 5 critical findings. One new HIGH-severity bug was introduced: web-side JSON parser parity regression (C7-CR-01). Two additional latent bugs identified in HTML and OFX web parsers.

---

## HIGH

### D7-DBG-01: Web-side JSON parser silently corrupts refunds

**File:** `apps/web/src/lib/parser/json.ts:101`
**Confidence:** High

Root cause: server-side fix (commit `fcd398b`) changed `amount` from `Math.abs(amount)` to raw `amount`, but web-side was never updated. The comment at lines 98-99 incorrectly documents the old behavior as matching server-side.

Failure mode: User uploads a JSON statement with refund transactions (negative amounts). Web app shows these as positive spending, inflating totals and producing incorrect optimization results.

Reproduction: Parse `[{date: '2024-01-15', merchant: 'Refund', amount: -15000}]` via web-side parser. Result has `amount: 15000` instead of `-15000`.

Fix: Remove `absAmount` variable. Pass `amount` directly to RawTransaction.

---

## MEDIUM

### D7-DBG-02: Web-side HTML parser silently corrupts refunds

**File:** `apps/web/src/lib/parser/html.ts:223`
**Confidence:** High

Root cause: web-side does `Math.abs(amount)` while server-side skips non-positive amounts. Different semantics produce different transaction counts and totals.

Failure mode: HTML statements with refunds show refund amounts as positive spending.

Fix: Align with server-side — skip non-positive amounts.

### D7-DBG-03: Web-side OFX timezone truncation

**File:** `apps/web/src/lib/parser/ofx.ts:43-49`
**Confidence:** Medium

Root cause: web-side strips timezone info from OFX DTPOSTED values. Server-side converts to KST.

Failure mode: A transaction at 2024-01-15T23:00:00-05:00 would be parsed as 2024-01-15 on web but 2024-01-16 on server (after KST conversion). Same file produces different dates.

Fix: Share server-side `parseOFXDate` with timezone handling.

---

## LOW

### D7-DBG-04: `FALLBACK_CATEGORY_LABELS` drift risk

**File:** `apps/web/src/lib/category-labels.ts:25-103`
**Confidence:** Low

Root cause: hardcoded fallback labels that can diverge from taxonomy. If a new category is added to YAML but not to this Map, CardDetail shows raw IDs instead of Korean labels.

Failure mode: Silent UI degradation when taxonomy changes.

Fix: Generate fallback at build time from categories.yaml.

---

## Verified Fixes

| Bug | Commit | Verification |
|-----|--------|------------|
| ParseError instanceof broken | `c55005d` | web-side now extends Error |
| JSON negative amounts (server) | `fcd398b` | negatives preserved |
| Path traversal via null bytes | `ea98316` | null bytes stripped |
| Symlink traversal | `ea98316` | lstatSync.isSymbolicLink() rejects |
| LLM consent hang | `2f3a3ee` | 30s timeout + AbortController |
