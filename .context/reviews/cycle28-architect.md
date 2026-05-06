# Architect Review — Cycle 28

## C28-ARCH01: Server-side amount parsing lacks a dedicated module
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/` (missing `amount.ts`)

The web side has `apps/web/src/lib/parser/amount.ts` as a clean, dedicated module for amount parsing. The server side buries `parseAmountString` inside `packages/parser/src/csv/shared.ts` and duplicates a `parseAmount` wrapper in `packages/parser/src/xlsx/index.ts`.

This violates the single-responsibility principle: `csv/shared.ts` should contain CSV-specific utilities, not the universal amount parser used by XLSX, PDF, HTML, and OFX parsers.

**Impact**: Future amount format changes require editing `csv/shared.ts`, which is counter-intuitive. New developers looking for amount parsing logic won't find it in an obvious location.

**Fix**: Create `packages/parser/src/amount.ts` that exports:
- `parseAmountString(raw: string): number | null` — the canonical string parser
- `parseAmount(raw: unknown): number | null` — the type-safe wrapper for cell values

Update all parsers to import from `amount.ts` instead of duplicating or importing from `csv/shared.ts`.

## C28-ARCH02: Parser package index.ts does not export parseAmount
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/index.ts`

The parser package's public API (`index.ts`) exports `parseAmountString` and `normalizeHTML` from `./csv/shared.js`, but does not export a `parseAmount` wrapper. Consumers that need to parse cell values (which may be numbers or strings) must either import from internal modules or reimplement the wrapper.

**Fix**: Add `parseAmount` to the public exports in `packages/parser/src/index.ts`.
