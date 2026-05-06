# Critic Review — CherryPicker (Cycle 37)

**Reviewer:** critic
**Scope:** Design decisions, technical debt, conceptual inconsistencies, maintainability
**Date:** 2026-05-06

---

## Summary

Cycle 37 is a maintenance cycle with no structural changes. The recent commits (C95-C99) added three new parsers and fixed several bugs. However, the fundamental architectural debt — parser duplication, type leakage, optimizer complexity — remains untouched. The cycle-reference convention continues to grow, and the deferral culture for structural issues shows no signs of abating. One new concern: the proliferation of "parity" comments without automated verification creates a false sense of safety.

---

## Critical Finding

### [C37-CRIT01-CRITICAL] "Parity" Comments Are a False Substitute for Shared Code

**Files:** `apps/web/src/lib/parser/html.ts`, `apps/web/src/lib/parser/ofx.ts`, `apps/web/src/lib/parser/json.ts`
**Confidence:** High

Every new parser file contains comments like "Parity with server-side packages/parser/src/html/index.ts (C98-02)". These comments create the illusion of verified cross-platform consistency, but:

1. **No automated verification exists** for HTML, OFX, or JSON parsers. Only CSV, XLSX, and PDF have parity tests.
2. **Comments rot.** When a bug is fixed in one file, the parity comment does not remind the fixer to update the other.
3. **Comments do not prevent divergence.** The web PDF parser is 44% larger than the server PDF parser despite parity comments.

The parity comment convention has become a psychological band-aid that justifies duplication rather than motivating unification.

**Fix:** Replace parity comments with a concrete plan to unify parsers. For HTML/JSON/OFX (pure string processing), this is achievable immediately. Add parity tests for all new formats as a minimum viable safeguard.

---

## High Findings

### [C37-CRIT02-HIGH] Silent Data Loss Is a Systemic Pattern, Not a Parser Bug

**Files:** All parsers (CSV, XLSX, PDF, HTML, JSON, OFX)
**Confidence:** High

Every parser in the codebase silently drops certain transaction types:
- CSV/XLSX/HTML: drops `amount <= 0` with no error (refunds, credits)
- JSON: drops `amount <= 0` with no error
- OFX: drops `rawAmount >= 0` with no error (credits, payments)
- PDF: drops negative amounts in fallback scanner

This is not documented in user-facing copy. A user uploading a statement with refunds will see fewer transactions and may not realize data was filtered. This undermines trust in a financial tool.

**Fix:** Choose one strategy and apply it uniformly:
- **Option A:** Include all transactions (including negatives) and let the calculator filter them with clear UI messaging
- **Option B:** Report filtered transactions as parse warnings with counts (`"3개의 환불/입금 거래가 필터링되었습니다"`)

---

### [C37-CRIT03-HIGH] Cycle Reference Convention Has Become Technical Debt

**Files:** Pervasive (e.g., `C98-02`, `C99-03`, `C100-01`, `C31-CR02`, `C32-V01`)
**Confidence:** High

The codebase contains 200+ cycle-reference comments across 50+ files. Their purposes:
- Link fixes to review cycles
- Claim parity between implementations
- Document edge cases

**Problems:**
1. **No index exists.** A new contributor cannot resolve what "C99-03" means.
2. **Inconsistent prefixes:** `C##-##`, `C##UI-##`, `C##-COR##`, `C##-F#`, `D##-M#`, `F#-##`
3. **Cycle 37 finds Cycle 32 references.** References to cycles 1-20 are already archaeological.
4. **They justify duplication:** "(C98-02, parity with server-side)" is used to avoid actually achieving parity.

**Fix:** Create `docs/cycle-references.md` mapping all active IDs, or migrate to self-contained comments. Remove references to cycles older than 10.

---

## Medium Findings

### [C37-CRIT04-MEDIUM] New Parsers Add Complexity Without Adding Value Proposition

**Files:** `packages/parser/src/html/index.ts`, `packages/parser/src/ofx/index.ts`, `packages/parser/src/json/index.ts`
**Confidence:** Medium

The HTML, OFX, and JSON parsers support formats that represent < 5% of likely user uploads (Korean banks primarily export CSV, XLSX, or PDF). The implementation effort for these parsers (~1300 lines) is disproportionate to their usage. More critically, each new format doubles the maintenance burden due to the server/web duplication.

**Assessment:** This is not a call to remove the parsers, but to recognize the cost. If usage data shows these formats are rarely used, consider deprecating them or moving them to a server-only pipeline.

---

### [C37-CRIT05-MEDIUM] `normalizeHTML` Is Both Sanitizer and Malformer Fixer

**File:** `apps/web/src/lib/parser/html.ts:29-54`, `packages/parser/src/csv/shared.ts:192-210`
**Confidence:** Medium

`normalizeHTML` has two unrelated responsibilities:
1. **Security:** Strip script tags, event handlers, JS URLs (XSS defense)
2. **Parsing:** Fix malformed closing tags (`</td >` → `</td>`)

These should be separate functions. A security-critical sanitizer should not also be responsible for markup repair, because a future "fix" to tag repair could inadvertently weaken the sanitizer.

**Fix:** Split into `sanitizeHTML` (security only) and `repairHTMLMarkup` (parsing only).

---

## Cross-Cycle Status: Deferral Culture

| Issue | First Reported | Status | Rationale Given |
|-------|---------------|--------|-----------------|
| Parser unification | Cycle 2 | Deferred | "Large refactoring with high regression risk" |
| Optimizer O(T^2 x C) | Cycle 12 | Deferred | "Needs benchmarking" |
| Type adapter tax | Cycle 35 | Deferred | "Large refactoring with high regression risk" |
| sessionStorage encryption | Cycle 35 | Deferred | "Requires UX design" |
| keywords.ts bundle size | Cycle 36 | Deferred | "Requires measurement" |

After 35+ cycles, none of these have exit criteria that have been met. The deferral mechanism is effectively a "won't fix" with extra steps.

**Recommendation:** For each deferred issue, either:
1. Schedule it for the next cycle with a concrete task owner, or
2. Close it as "won't fix" with explicit rationale

The current state — 40+ plan files, many stale, most issues deferred indefinitely — creates cognitive overhead for every new review cycle.
