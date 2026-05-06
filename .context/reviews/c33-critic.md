# Cycle 33 Multi-Perspective Critique — CherryPicker

**Agent:** c33-critic  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Product: Missing offline capability and progressive enhancement

**Severity:** MEDIUM  
**Confidence:** High

The web app requires network access for category labels (`loadCategories()`) and card rules. If the user loses connectivity after uploading a statement, they cannot view results. A service worker caching static assets and the category/card JSON would enable offline review.

**Files:** `apps/web/src/lib/cards.ts`, `apps/web/src/lib/category-labels.ts`

---

## Engineering: Significant parser duplication between web and server

**Severity:** MEDIUM  
**Confidence:** High

The web-side parsers (`apps/web/src/lib/parser/*.ts`) duplicate logic from server-side parsers (`packages/parser/src/*/`). This was noted in C32-F1/F3 where fixes had to be applied twice. The monorepo structure should allow sharing parser code, but the web-side uses browser APIs (TextDecoder) while server-side uses Node/Bun APIs (Buffer).

**Suggested fix:** Extract shared logic (column matching, header detection, forward-fill patterns) into `packages/parser/src/shared/` and import from both sides.

**Files:** `apps/web/src/lib/parser/html.ts` vs `packages/parser/src/html/index.ts`

---

## Maintainability: `keywords.ts` is 3972+ lines — unmaintainable at scale

**Severity:** LOW  
**Confidence:** High

The merchant keyword map is a single massive object. Adding/removing entries requires editing a file that takes seconds to scroll through. No automated tooling ensures consistency.

**Suggested fix:** Split by category or use a build-step that merges smaller JSON files.

**File:** `packages/core/src/categorizer/keywords.ts`

---

## UX: Error messages are Korean-only with no i18n infrastructure

**Severity:** LOW  
**Confidence:** High

All user-facing strings are hardcoded in Korean. There is no i18n framework or message catalog. Adding English or other languages would require touching dozens of files.

**Files:** Throughout `apps/web/src/`

---

## Final Sweep

- Monorepo package boundaries are clean.
- Core package successfully avoids runtime-specific APIs.
- Test coverage is good for core packages but thin for web UI.
