# Architect — Cycle 4 Findings

## Summary
7 findings on system boundaries, data flow, and long-term maintainability. 2 critical, 3 high, 2 medium.

## Findings

### A-ARCH-01 [CRITICAL] Server/web parser code duplication
- **Files**: `packages/parser/src/` vs `apps/web/src/lib/parser/`
- **Issue**: Two copies of every parser. The web versions (csv.ts, xlsx.ts, pdf.ts, html.ts) are hand-maintained duplicates. This is the single largest architectural debt in the repo.
- **Options**: (a) Make `packages/parser` isomorphic (remove Bun-only APIs), (b) Extract shared post-processing to `packages/shared/`, (c) Generate web parsers from server parsers.
- **Recommended**: Option (b) — extract `normalizeTransactions()` and `validateAmount()` to shared package. Keep format-specific extraction in each environment.

### A-ARCH-02 [CRITICAL] CATEGORY_NAMES_KO hardcoded in optimizer
- **File**: `packages/core/src/optimizer/greedy.ts` lines 11-89
- **Issue**: Category taxonomy lives in YAML but optimizer hardcodes Korean labels. Build-time generation or runtime load needed.
- **Fix**: Load categories from YAML at startup, cache in optimizer.

### A-ARCH-03 [HIGH] Card rules type duplicated in web app
- **File**: `apps/web/src/lib/cards.ts` lines 14-52
- **Issue**: Web app redefines `CardRuleSet` instead of importing from `@cherrypicker/rules`. Schema evolution requires manual sync across packages.
- **Fix**: Export shared types from `packages/rules` and import in web.

### A-ARCH-04 [HIGH] No clear boundary between parser and categorizer
- **Files**: `packages/parser/src/` vs `packages/core/src/categorizer/`
- **Issue**: Parsers return raw transactions; categorizer runs separately. But some parser logic (e.g., merchant normalization) could inform categorization.
- **Fix**: Define clear contract: parser outputs `{ date, merchant, amount }[]`; categorizer takes that and returns `CategorizedTransaction[]`. Document in ARCHITECTURE.md.

### A-ARCH-05 [HIGH] Web store persists to sessionStorage with no schema versioning
- **File**: `apps/web/src/lib/store.svelte.ts`
- **Issue**: `STORAGE_VERSION = 1` exists but no migration logic. If schema changes, stale storage causes silent failures.
- **Fix**: Add migration runner and versioned storage schema.

### A-ARCH-06 [MEDIUM] Monorepo workspace boundaries are soft
- **Files**: Root `package.json`, workspace configs
- **Issue**: No enforced dependency rules. `apps/web` could accidentally import Bun-only packages.
- **Fix**: Add Nx or custom lint rule enforcing package boundaries.

### A-ARCH-07 [MEDIUM] Scraping pipeline has no orchestration layer
- **Files**: `tools/scraper/src/`
- **Issue**: Single-file extraction with no queue, retry, or rate limiting. Card rule updates are manual one-offs.
- **Fix**: Add simple queue with exponential backoff and rate limiter.

## Recommendations
1. Create `packages/shared/` for isomorphic utilities (amount validation, date parsing)
2. Add `ARCHITECTURE.md` documenting package boundaries
3. Consider Nx or Turborepo for workspace enforcement
4. Build category loading from YAML into `packages/core` initialization
