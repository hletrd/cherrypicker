# Cycle 9 — Architect

**Reviewer:** architect (manual)
**Scope:** Architectural/design risks, coupling, layering
**Date:** 2026-05-06

---

## Summary

No new structural regressions. The normalizeHTML extraction (C100-04) reduced duplication between server-side HTML and XLSX parsers. However, the fundamental server/web parser duplication problem remains unresolved. A new micro-divergence was found in the HTML parser's amount parsing import.

---

## Verified Improvements

### C100-04 FIXED: normalizeHTML extracted to shared module
- `packages/parser/src/csv/shared.ts:180-182` — shared `normalizeHTML()`
- `packages/parser/src/html/index.ts:14` — imports from shared
- `packages/parser/src/xlsx/index.ts:7` — imports from shared

---

## Still Open Findings

### A-ARCH-01 [HIGH] Server/web parser structural duplication

**Evidence:** `apps/web/src/lib/parser/csv.ts`, `pdf.ts`, `xlsx.ts`, `html.ts`, `json.ts`, `ofx.ts`, `date-utils.ts`, `column-matcher.ts`, `detect.ts` all exist as separate implementations.

**Status:** Unchanged after 7+ cycles. The duplication is the single largest source of parity bugs.

**Exit criterion:** Either (a) extract shared pure-logic modules into a browser-compatible package, or (b) generate web parsers from server parsers via codegen, or (c) add automated parity tests that fail CI on divergence.

---

### C8-06 [MEDIUM] build-json.ts duplicates Zod schemas

**File:** `scripts/build-json.ts:18-83`
**Confidence:** High

The card rule schemas (`cardRuleSetSchema`, `rewardRuleSchema`, etc.) are defined inline instead of importing from `@cherrypicker/rules`. If the rules package schemas change, build-json.ts will not catch up.

**Fix:** Import schemas from `@cherrypicker/rules/src/schema.ts`.

---

## New Findings

### C9-ARCH-01 [LOW] Web-side HTML parser imports amount parser from different module than server-side

**File:** `apps/web/src/lib/parser/html.ts:10`
**Confidence:** Medium

Server-side: `import { parseAmountString } from '../csv/shared.js'`
Web-side: `import { parseCSVAmount } from './csv.js'`

Functionally equivalent but creates an unnecessary architectural divergence point. If the shared module gains new capabilities (e.g., new currency format), the web HTML parser won't benefit.

**Fix:** Export `parseAmountString` from web-side csv module, or import `parseCSVAmount` on server side for naming consistency.

---

## Verdict

**ACCEPT TECHNICAL DEBT:** A-ARCH-01 (parser duplication) requires significant refactor effort — defer with mandatory parity tests as exit criterion.
**FIX NOW:** C8-06 (schema duplication — straightforward import change)
