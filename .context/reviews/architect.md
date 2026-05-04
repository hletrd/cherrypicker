# Cycle 67 Architect Review

## Focus: Server/Web Parity Gaps

### F1: Web-side CSV parser missing splitCSVContent (SERVER/WEB PARITY - HIGH)
**Files**: `apps/web/src/lib/parser/csv.ts` lines 216, 406
Server-side CSV parser uses `splitCSVContent()` for RFC 4180 multi-line quoted field handling (cycle 66). The web-side still uses `content.split('\n').filter(l => l.trim())` in both generic parser and bank adapter factory. Korean bank CSV exports from Excel may include merchant names or memos with embedded line breaks inside quotes, causing data loss on the web side.

### F2: Web-side adapter skip condition parity (SERVER/WEB PARITY - LOW)
**File**: `apps/web/src/lib/parser/csv.ts` line 441
Server uses `if (!dateRaw && !merchantRaw && !amountRaw) continue;` but web uses `if (!dateRaw && !merchantRaw) continue;`. Minor but should be aligned.

### F3: Web-side missing console.warn on adapter detect failure (OBSERVABILITY - LOW)
Server-side `packages/parser/src/csv/index.ts` line 100 logs failures; web-side does not.

### F4: Web-side missing column detection failure error (UX - LOW)
Server-side generic CSV reports `필수 컬럼을 찾을 수 없습니다` when columns not found; web-side does not.