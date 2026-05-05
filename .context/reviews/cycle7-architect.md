# Cycle 7 Architecture Review

**Date:** 2026-05-05
**Scope:** Post-Cycle-6 fixes and structural debt
**Reviewer:** architect

---

## Summary

Cycle 6 extracted `buildCategoryLabelMap` successfully, eliminating a duplication anti-pattern. However, the fundamental server/web parser duplication remains unaddressed, and a new duplication has emerged in the web app's fallback category labels.

---

## HIGH

### A7-ARCH-01: Web-side JSON parser parity regression

**File:** `apps/web/src/lib/parser/json.ts:101`
**Confidence:** High

See C7-CR-01 (code-reviewer). The server/web duplication is not just structural but behavioral — the same fix (preserve negative amounts) was applied to server-side only, leaving web-side with the old behavior. This demonstrates that maintaining two parser implementations guarantees drift.

### A7-ARCH-02: `FALLBACK_CATEGORY_LABELS` duplicates taxonomy in web app

**File:** `apps/web/src/lib/category-labels.ts:25-103`
**Confidence:** High

A 78-entry hardcoded `Map` duplicates the canonical taxonomy from `packages/rules/data/categories.yaml`. The comment admits: "Must be updated in lockstep with categories.yaml taxonomy" — this is exactly the maintenance burden that `buildCategoryLabelMap` was extracted to eliminate (C6-03). The web app has recreated the same anti-pattern that `CATEGORY_NAMES_KO` suffered from in Cycle 6.

**Fix:** Import `buildCategoryLabelMap` from `@cherrypicker/rules` and remove `FALLBACK_CATEGORY_LABELS`. If the fallback is needed for offline resilience, generate it at build time from the YAML source.

---

## MEDIUM

### A7-ARCH-03: Server/web parser duplication — 6 cycles without structural fix

**Files:** `packages/parser/` vs `apps/web/src/lib/parser/`
**Confidence:** High

After 6+ cycles of parity fixes (forward-fill, negative amounts, ParseError class, column patterns, date validation), the structural duplication persists. Every new format (JSON, OFX, HTML) has been implemented twice. The cost of parity maintenance now exceeds the cost of extracting a shared parser core.

**Fix:** Extract shared parser logic into `packages/parser/src/shared/` (or similar) and have both server and web import from it. The shared core should be pure TypeScript with no Node/Bun-specific APIs.

### A7-ARCH-04: Web-side OFX parser lacks timezone handling

**File:** `apps/web/src/lib/parser/ofx.ts:43-49`
**Confidence:** Medium

Server-side OFX parser has KST timezone conversion (`packages/parser/src/ofx/index.ts:75-102`). Web-side strips non-digits and returns raw. For transactions near midnight with timezone offsets, this produces different dates between server and web.

**Fix:** Share `parseOFXDate` implementation between server and web.

---

## LOW

### A7-ARCH-05: HTML report generator mixes template + string concatenation

**File:** `packages/viz/src/report/generator.ts`
**Confidence:** Low

The generator reads an HTML template then uses `replaceAll` for substitution. This is fragile — if template placeholders are missing or renamed, the replacement silently fails. A structured template engine or tagged template literals would be more robust.

---

## Cross-Cutting Themes

1. **Duplication debt regenerates:** `FALLBACK_CATEGORY_LABELS` is the new `CATEGORY_NAMES_KO`. Shared utilities prevent this class of bug, but only if all call sites adopt them.
2. **Parser parity is asymptotic:** Without structural unification, parity fixes will continue indefinitely. Each new format or edge case doubles the maintenance burden.
