# Cycle 3 Test Engineering Review

**Reviewer:** test-engineer
**Date:** 2026-05-05
**Scope:** apps/web/__tests__/*, packages/parser/__tests__/*

---

## Findings

### F1: No tests for new JSON parser (web-side) (Medium Confidence)

**File:** `apps/web/src/lib/parser/json.ts`

**Problem:** The web-side JSON parser was added in cycle 97 but there are no web-side tests for it. The server-side JSON parser has tests in `packages/parser/__tests__/json.test.ts`, but the web-side implementation (which imports `parseCSVAmount` from `csv.ts` instead of the server shared module) has independent test coverage.

**Risk:** The web-side JSON parser uses `parseCSVAmount` from the web CSV parser for amount normalization. If the web CSV parser changes, JSON amount parsing could break without detection.

**Confidence:** Medium

---

### F2: No tests for new HTML parser (web-side) (Medium Confidence)

**File:** `apps/web/src/lib/parser/html.ts`

**Problem:** Similar to F1 — the web-side HTML parser exists but has no dedicated web-side tests. The server-side HTML parser has tests in `packages/parser/__tests__/html.test.ts`.

**Confidence:** Medium

---

### F3: No tests for new OFX parser (web-side) (Medium Confidence)

**File:** `apps/web/src/lib/parser/ofx.ts`

**Problem:** The web-side OFX parser was added in cycle 98/100 but lacks web-side tests.

**Confidence:** Medium

---

### F4: FileDropzone accept attribute mismatch not covered by tests (Low Confidence)

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Problem:** The `isValidFile()` function has logic for all supported types, but the HTML `accept` attribute restricts the file picker. No existing test validates that the `accept` attribute matches `ACCEPTED_EXTENSIONS`.

**Confidence:** Low

---

## Final Sweep

Test coverage for the core parser packages is excellent (1393 tests). The web-side tests (`apps/web/__tests__/*`) focus on analyzer adapters, formatters, and parser utilities but do not cover the new JSON, HTML, or OFX parsers.
