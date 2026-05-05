# Cycle 100 Aggregate Review (FINAL CYCLE)

## Summary
Final cycle (100/100). Deep review focusing on server/web parity bugs, real-world edge cases, and architecture cleanup. Found 6 new issues — 3 high severity are server/web parity bugs that cause data loss or different parsing results.

## New Findings (6)

| ID | Severity | Type | Description |
|----|----------|------|-------------|
| F1 | HIGH | RELIABILITY | Web HTML parser missing forward-fill for merged cells — data loss |
| F2 | HIGH | RELIABILITY | Web JSON parser rejects negative amounts (server accepts + abs) |
| F3 | HIGH | RELIABILITY | Web OFX parser missing CCSTMTRS/CREDITCARDMSGSRSV1 terminators |
| F4 | MEDIUM | RELIABILITY | Web format detection lacks content sniffing for unknown extensions |
| F5 | LOW | ARCHITECTURE | Duplicate normalizeHTML() in HTML and XLSX parsers |
| F6 | LOW | TESTS | Zero test coverage for web-side parsers |

## Detailed Findings

### F1: Web HTML parser missing forward-fill [HIGH]
- **File**: `apps/web/src/lib/parser/html.ts`
- **Impact**: Korean bank HTML exports with merged cells lose transaction data in web app
- **Root cause**: Server-side HTML parser was updated with forward-fill (cycle 99), web-side was not
- **Fix**: Add forward-fill pattern matching server-side HTML parser for all 6 columns

### F2: Web JSON parser rejects negative amounts [HIGH]
- **File**: `apps/web/src/lib/parser/json.ts` line 90
- **Impact**: JSON API responses with negative amounts (refunds) produce different results server vs web
- **Root cause**: Web-side uses `amount <= 0` filter; server-side uses `Math.abs(amount)`
- **Fix**: Match server-side behavior — accept negative, store absolute value

### F3: Web OFX parser missing CCSTMTRS terminator [HIGH]
- **File**: `apps/web/src/lib/parser/ofx.ts` line 18
- **Impact**: Credit card OFX files may produce incorrect results on web-side
- **Root cause**: SGML regex only has bank statement terminators, not credit card
- **Fix**: Add `</CCSTMTRS` and `</CREDITCARDMSGSRSV1` to SGML terminator pattern

### F4: Web format detection lacks content sniffing [MEDIUM]
- **File**: `apps/web/src/lib/parser/detect.ts`
- **Impact**: Files with wrong extensions default to CSV
- **Fix**: Deferred — browser FileReader limits make this complex

### F5: Duplicate normalizeHTML [LOW]
- **Files**: `packages/parser/src/html/index.ts`, `packages/parser/src/xlsx/index.ts`
- **Fix**: Extract to shared utility

### F6: No web-side parser tests [LOW]
- **Fix**: Deferred — would require significant test infrastructure for browser environment