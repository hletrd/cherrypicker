# Cycle 100 — Architecture Review

## Architecture Assessment

### Server vs Web Parser Duplication

The parser architecture has a **systemic duplication problem** between:
- `packages/parser/src/` (server-side, runs on Bun)
- `apps/web/src/lib/parser/` (web-side, runs in browser)

**Duplicated modules** (nearly identical code):
1. `detect.ts` — BANK_SIGNATURES array (24 banks), detectBank(), detectCSVDelimiter()
2. `ofx/index.ts` — extractTransactionBlocks(), extractTag(), parseOFXDate(), parseOFXAmount()
3. `json/index.ts` — ALL field aliases, findField(), normalizeAmount(), parseTransactionObject()
4. `html/index.ts` — normalizeHTML(), parseHTML(), parseHTMLSheet() — BUT with divergence (web lacks forward-fill)
5. `column-matcher.ts` — Already shared (good!)
6. `date-utils.ts` — Already shared (good!)

### Why Duplication Persists

The server package uses `Buffer` and Node.js APIs (`fs/promises`), while the web package runs in the browser. The shared code (column-matcher, date-utils) works in both environments because it's pure string/regex work.

The duplicated code is ALSO pure string/regex work — it could theoretically be shared. The blocker is that the package uses `.js` extension imports (`../csv/shared.js`), which the web bundler (Vite/Astro) resolves differently than Bun.

### Recommendation for Future

The OFX, JSON, and detect modules contain no Node.js-specific code. They could be extracted into a shared package or symlinked. This is a medium-effort refactor that would prevent the parity bugs found in this cycle.

### Extensibility Assessment

The parser architecture is **reasonably extensible**:
- Adding a new bank adapter: straightforward via `adapter-factory.ts`
- Adding a new format: requires updates to `detect.ts`, `types.ts`, `index.ts`, and a new parser module
- Column matching: well-designed shared system via `column-matcher.ts`

The main extensibility risk is that every change must be made in two places (server + web).