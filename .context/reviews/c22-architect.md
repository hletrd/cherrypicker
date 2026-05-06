# Cycle 22 — Architect

**Date:** 2026-05-05
**Scope:** packages/parser/, apps/web/src/lib/parser/
**Previous:** 21 cycles completed

---

## Finding C22-ARCH01: normalizeHTML exists in three locations despite extraction effort [LOW]

**Files:**
- `packages/parser/src/csv/shared.ts:181` — canonical server-side implementation
- `packages/parser/src/html/index.ts:14` — imports from shared.ts (correct)
- `apps/web/src/lib/parser/html.ts:29-43` — standalone web-side copy
- `apps/web/src/lib/parser/xlsx.ts:5` — imports from `./html.js` (web-side copy)

**Problem:** Commit 8fb7603 extracted `normalizeHTML` to `packages/parser/src/csv/shared.ts` and updated the server-side HTML and XLSX parsers to import from there. However, the web-side HTML parser (`apps/web/src/lib/parser/html.ts`) still contains its own copy of `normalizeHTML` with identical logic. The web-side XLSX parser imports from `./html.js` (the web-side copy) instead of a shared module.

This means there are now THREE copies of `normalizeHTML` in the codebase:
1. Server-side shared.ts (canonical)
2. Web-side html.ts (duplicate)
3. Previously extracted from server-side xlsx/index.ts (now imports from shared.ts)

**Impact:** Any future update to HTML sanitization rules must be applied in two places. This increases maintenance burden and risks drift between server and web behavior.

**Fix:** When the D-01 architectural refactor (shared module between Bun and browser) is implemented, consolidate the web-side `normalizeHTML` to import from the shared module. Until then, document the duplication in both files.

**Confidence:** High

---

## Finding C22-ARCH02: Web-side JSON amount handling depends on optimizer filter [LOW]

**File:** `apps/web/src/lib/parser/json.ts:98-100`

**Problem:** The JSON parser preserves negative amounts (refunds/credits) and relies on the optimizer's `tx.amount > 0` filter to exclude them. This creates a cross-package contract where the parser assumes the optimizer will filter negatives. If the optimizer filter is ever removed or a new optimizer variant is introduced that doesn't filter negatives, incorrect data would flow into the optimization results.

**Impact:** Low in the current architecture (only one optimizer exists), but violates the principle that each layer should validate its own output contract.

**Fix:** Add a post-parse validation step or document the contract explicitly in the parser's return type.

**Confidence:** Medium

---

## Architecture Health Check

- **Parser duplication (D-01):** Still 6 formats duplicated (server + web). No progress this cycle.
- **Shared column-matcher module:** Working well, patterns kept in sync.
- **Error reporting:** Consistent Korean messages across parsers.
- **Test parity:** Server/web parity tests exist for XLSX, PDF, and detection. Good coverage.

---

## Regressions

None found.
