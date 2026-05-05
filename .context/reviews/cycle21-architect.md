# Cycle 21 — Architecture Review

## C21-ARCH01: Parser duplication persists — now 6 formats, 2 environments (LOW)

**Files:** `apps/web/src/lib/parser/` vs `packages/parser/src/`
**Confidence:** High

The systemic duplication between server-side and web-side parsers continues. Each new format added requires implementation in both places:

| Format | Server | Web | Status |
|--------|--------|-----|--------|
| CSV | Yes | Yes | Duplicated |
| XLSX | Yes | Yes | Duplicated |
| PDF | Yes | Yes | Duplicated |
| JSON | Yes | Yes | Duplicated |
| OFX | Yes | Yes | Duplicated |
| HTML | Yes | Yes | Duplicated |

The shared modules (`column-matcher.ts`, `date-utils.ts`) work in both environments because they are pure string/regex logic. The duplicated parsers (CSV, XLSX, PDF, JSON, OFX, HTML) are ALSO pure string/regex logic — they could theoretically be shared.

**Blocker:** The server package uses `.js` extension imports (`../csv/shared.js`) which Vite/Astro resolves differently than Bun. The `normalizeHTML` function was recently extracted to `packages/parser/src/csv/shared.ts` and imported by both HTML and XLSX parsers on the server side (C100-04), showing that shared extraction is possible when import paths align.

**Recommendation:** Schedule a dedicated refactoring sprint to extract isomorphic parsing logic to a shared pure-TS package. Start with the smallest module (e.g., `normalizeHTML` is already shared on server-side; extend to web-side).

---

## C21-ARCH02: Web-side XLSX parser imports from HTML module (LOW)

**File:** `apps/web/src/lib/parser/xlsx.ts:5`
**Confidence:** Medium

`import { normalizeHTML } from './html.js'` creates a coupling where the XLSX parser depends on the HTML parser module. This is for HTML-as-XLS detection, which is legitimate, but it means changes to the HTML parser's `normalizeHTML` (e.g., adding more sanitization rules) affect the XLSX parser unexpectedly.

**Fix:** Extract `normalizeHTML` to a shared utilities file (e.g., `./shared.ts` or `./utils.ts`) that both HTML and XLSX parsers import. This mirrors the server-side architecture where `normalizeHTML` lives in `csv/shared.ts`.
