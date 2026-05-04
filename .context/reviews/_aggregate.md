# Cycle 67 Aggregate Review

## Findings (4 actionable)

### F1: Web-side CSV parser missing splitCSVContent (FORMAT DIVERSITY - HIGH)
**Files**: `apps/web/src/lib/parser/csv.ts` lines 216, 406
Server-side uses `splitCSVContent()` for multi-line quoted fields. Web-side uses naive split. Causes data loss on CSVs with quoted fields containing newlines.

### F2: Web-side adapter skip condition missing amountRaw (SERVER/WEB PARITY - LOW)
**File**: `apps/web/src/lib/parser/csv.ts` line 441
Web-side: `if (!dateRaw && !merchantRaw) continue;` vs server: `if (!dateRaw && !merchantRaw && !amountRaw) continue;`

### F3: Web-side missing console.warn on adapter detect failure (OBSERVABILITY - LOW)
**File**: `apps/web/src/lib/parser/csv.ts`
Server logs adapter detection failures; web-side does not.

### F4: Web-side missing column detection failure error (UX - LOW)
**File**: `apps/web/src/lib/parser/csv.ts`
Server reports `필수 컬럼을 찾을 수 없습니다` when columns not found; web-side silently returns empty.

## Deferred
None.