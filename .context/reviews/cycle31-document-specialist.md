# Cycle 31 Document Specialist Review

**Scope:** Doc/code mismatches, inline comment accuracy, and authoritative source alignment.

---

## New Findings

### C31-DOC01 | LOW | High | `packages/parser/src/ofx/index.ts:16`

**Comment says "OFX 2.x uses XML-style with proper closing tags" but the regex doesn't require proper closing**

The `extractTransactionBlocks` function uses `/<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi` for XML-style extraction, which DOES require closing tags. But the fallback SGML pattern `/<STMTTRN[^>]*>([\s\S]*?)(?=<STMTTRN|<\/BANKTRANLIST|...)` handles unclosed tags. The comment is accurate but could be clearer that both styles are tried in sequence.

**Fix:** Clarify comment: "XML-style blocks are tried first; if none found, fall back to SGML-style."

### C31-DOC02 | LOW | Medium | `apps/web/src/lib/parser/json.ts:5-6`

**File header claims "Parity with server-side" but imports differ**

The web-side imports `parseCSVAmount` from `./csv.js` while the server-side imports `parseCSVAmount` from `../csv/shared.js`. The implementations are the same (both alias `parseAmount`), but the import paths differ. The parity comment is accurate in behavior but misleading about module structure.

**Fix:** Update comment to note that import paths differ but behavior is identical.

### C31-DOC03 | LOW | Medium | `apps/web/src/lib/parser/html.ts:25`

**SheetJS import comment says "CommonJS module" but import syntax is ES module**

The comment says `// SheetJS is imported as a CommonJS module` but the code uses `import * as xlsx from 'xlsx'`. This is ES module syntax, not CommonJS `require`.

**Fix:** Update comment to reflect actual import style.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| D-02 | OPEN (LOW) | README still says MIT, LICENSE is Apache 2.0 |
| D-06 | OPEN (MEDIUM) | Browser CSV support documentation may overstate adapter coverage |

---

## Final Sweep

1. All recent commits include ticket references (C98, C99, C100, etc.)
2. Korean comments and user-facing messages use natural language per AGENTS.md
3. No stale TODO comments found in new code
4. Function JSDoc comments are present and accurate
