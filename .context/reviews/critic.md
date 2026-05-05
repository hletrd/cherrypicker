# Critic — cherrypicker (Cycle 5)

**Reviewer:** critic (opus)
**Scope:** Full repository — design, maintainability, deferred-fix tracking
**Date:** 2026-05-05

---

## Summary

The codebase is functional and well-tested for its domain but carries significant architectural debt from rapid iteration. The server/web parser duplication is the single largest design flaw — it violates DRY, doubles maintenance cost, and has already caused 20+ parity bugs. The deferred-fix system itself needs improvement: items are tracked in per-cycle plan files but there's no master registry showing what was fixed, what was deferred, and why.

---

## New Findings (Cycle 5)

### [P0-CRITICAL] Server/web parser duplication — no structural fix after 4 cycles

**Files:** `packages/parser/src/` vs `apps/web/src/lib/parser/`
**Confidence:** High

This issue has been reported in every cycle since cycle 2. The fix has been deferred each time because "it requires significant refactoring." But the cost of NOT fixing it compounds with every new format. JSON, OFX, and HTML parsers were recently added to the server side; the web side may or may not have parity.

**The real question:** Why does the web side need its own parser at all? The web app runs in a browser. The parsers use `TextDecoder`, `RegExp`, and basic string operations — all available in browsers. The only Node/Bun-specific APIs are `fs/promises` (file reading) and `xlsx` (SheetJS, which works in browsers). Extract file I/O from the parsers and the rest is isomorphic.

**Fix:** Create `packages/parser/src/shared/` with pure TypeScript parsing logic. Server entry points add file I/O. Web entry points add `FileReader`/blob handling. Both consume the same core logic.

---

### [P1-HIGH] Deferred-fix tracking is fragmented across cycle files

**Files:** `.context/plans/00-deferred-items.md`, `01-critical-fixes.md`, etc.
**Confidence:** High

Deferred items are spread across per-cycle plan files. There's no single view of what was deferred, in which cycle, and the exit criterion. When a cycle ends, its deferred items may be forgotten unless someone reads all historical plan files.

**Example:** The parser duplication issue was deferred in cycles 2, 3, and 4. Each cycle created a new plan file referencing the same issue. The `.context/plans/` directory now has 20+ files, making it hard to find the authoritative deferred list.

**Fix:** Maintain a single `DEFERRED.md` at `.context/reviews/` with columns: ID, Finding, First Cycle, Severity, Reason for Deferral, Exit Criterion, Status.

---

### [P1-HIGH] CATEGORY_NAMES_KO hardcoded — taxonomy coupling not addressed

**File:** `packages/core/src/optimizer/greedy.ts:11-90`
**Confidence:** High

79 lines of hardcoded Korean category labels duplicate `packages/rules/data/categories.yaml`. This has been reported in cycles 3 and 4. The TODO comment at line 8 acknowledges the drift risk. Yet no build-time generation or runtime loading was implemented.

**The deeper issue:** `packages/core` is described as "Pure TS, no runtime-specific APIs." But it needs category data. The clean solution is to accept category labels as a constructor parameter or load them at initialization time, not compile them into the source.

**Fix:** Generate `CATEGORY_NAMES_KO` from YAML at build time via a script, or accept a `categoryLabels: Map<string, string>` parameter in `optimize()`.

---

### [P2-MEDIUM] Web app redefines core types instead of importing

**File:** `apps/web/src/lib/cards.ts:14-52`
**Confidence:** High

`CardRuleSet` is redefined inline with 38 lines of type duplication. `packages/rules` exports `CardRuleSet` from Zod schema inference. The web app could import it directly but doesn't.

**Fix:** Import from `@cherrypicker/rules`. The web app's `package.json` already depends on `@cherrypicker/rules`.

---

### [P2-MEDIUM] No correctness proof or benchmark for greedy optimizer

**File:** `packages/core/src/optimizer/greedy.ts`
**Confidence:** Medium

The greedy algorithm assigns each transaction to the card with the highest marginal reward. This is a local optimization — no guarantee of global optimality. For small N (<=10 cards), brute-force is feasible. The codebase has no benchmark comparing greedy vs brute-force, no approximation ratio documentation.

**Fix:** Add a brute-force verifier for N<=10 cards, document the approximation ratio in code comments.

---

### [P3-LOW] PDF parsing has three independent code paths

**Files:** `packages/parser/src/pdf/index.ts`, `llm-fallback.ts`, web-side `pdf.ts`
**Confidence:** Low

Structured parse, fallback line scanner, and LLM fallback are three separate implementations with no shared post-processing. Every new format feature (e.g., installment extraction, category detection) must be implemented three times.

**Fix:** Extract a `normalizeTransaction()` post-processing pipeline shared across all three paths.

---

## Previously Reported — Status

| Finding | Cycle | Status | Notes |
|---------|-------|--------|-------|
| Server/web parser duplication | 2-4 | **OPEN** | No structural fix |
| CATEGORY_NAMES_KO hardcoded | 3-4 | **OPEN** | Still hardcoded |
| No brute-force benchmark | 4 | **OPEN** | No benchmark added |
| Card rules type duplicated | 4 | **OPEN** | Still inline |
| Deferred-fix violations | 4 | **OPEN** | Tracking still fragmented |
| PDF three code paths | 4 | **OPEN** | No unification |
| No automated rule validation | 4 | **OPEN** | No CI validation |

---

## Verdict

**REDESIGN REQUIRED** for parser architecture. The duplication is unsustainable. Everything else is **FIX AND SHIP**.
