# Cycle 22 Implementation Plan

## Fixes (ordered by priority)

### 1. C22-01: Full-width dot in date patterns (MEDIUM — FORMAT DIVERSITY)

**Files:**
- `packages/parser/src/csv/generic.ts` — DATE_PATTERNS (lines 24-30)
- `packages/parser/src/date-utils.ts` — parseDateStringToISO full match + short match
- `apps/web/src/lib/parser/csv.ts` — DATE_PATTERNS (lines 128-134)
- `apps/web/src/lib/parser/date-utils.ts` — parseDateStringToISO full match + short match
- `packages/parser/src/pdf/index.ts` — fallbackDatePattern (line 277), STRICT_DATE_PATTERN (line 15), SHORT_MD_DATE_PATTERN (line 19)
- `apps/web/src/lib/parser/pdf.ts` — fallbackDatePattern (line 509), STRICT_DATE_PATTERN (line 38), SHORT_MD_DATE_PATTERN (line 42)

**Problem:** Date regexes only match ASCII `.` separator. Korean bank exports occasionally use full-width dot (U+FF0E `．`) or ideographic full stop (U+3002 `。`). Dates like `2024．01．15` fail to parse, causing transaction loss.

**Fix:** Update `[.\-\/]` character classes in date regexes to include full-width dot variants. In regex: `[.\-\/\．\。]` or equivalently `[.\-\/．。]`.

Specific changes per file:

**CSV DATE_PATTERNS** (both server and web):
```ts
const DATE_PATTERNS = [
  /^\d{4}[\s]*[.\-\/．。][\s]*\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}$/,  // 2024-01-15, 2024．01．15
  /^\d{2}[\s]*[.\-\/．。][\s]*\d{2}[\s]*[.\-\/．。][\s]*\d{2}$/,       // 24-01-15, 24．01．15
  /^\d{4}\d{2}\d{2}$/,                                           // 20240115
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,                          // 2024년 1월 15일
  /^\d{1,2}월\s*\d{1,2}일$/,                                    // 1월 15일
];
```

**date-utils.ts parseDateStringToISO** (both server and web):
- Full date match: `/^(\d{4})[\s]*[.\-\/．。][\s]*(\d{1,2})[\s]*[.\-\/．。][\s]*(\d{1,2})/`
- Short year match: `/^(\d{2})[.\-\/．。](\d{2})[.\-\/．。](\d{2})$/`
- Short date match: `/^(\d{1,2})[.\-\/．。](\d{1,2})$/`
- Also update split pattern: `value.trim().split(/[.\-\/．。]/)`

**PDF STRICT_DATE_PATTERN** (both server and web):
- `/(\d{4})[.\-\/．。](\d{1,2})[.\-\/．。](\d{1,2})/`

**PDF SHORT_YEAR_DATE_PATTERN** (both server and web):
- `/(\d{2})[.\-\/．。](\d{2})[.\-\/．。](\d{2})/`

**PDF SHORT_MD_DATE_PATTERN** (both server and web):
- `/^\d{1,2}[.\-\/．。]\d{1,2}$/`

**PDF isValidShortDate split** (both server and web):
- `cell.split(/[.\-\/．。]/)`

**PDF fallbackDatePattern** (both server and web):
- Update `[.\-\/]` to `[.\-\/．。]` in all date sub-patterns

**Tests:** Add test cases in `packages/parser/__tests__/date-utils.test.ts` and `packages/parser/__tests__/csv.test.ts`:
- `2024．01．15` → `2024-01-15`
- `24．01．15` → `2024-01-15`
- `1．15` → inferred year + `01-15`
- `2024。01。15` → `2024-01-15`

### 2. C22-02: Web CSV reservedCols -1 filter parity (LOW)

**File:** `apps/web/src/lib/parser/csv.ts` line 240

**Fix:** Add `.filter((c) => c !== -1)` to match server-side:
```ts
const reservedCols = new Set([dateCol, amountCol, installmentsCol, categoryCol, memoCol].filter((c) => c !== -1));
```

**Tests:** Existing tests should continue to pass.

## Deferred
- D-01 through D-09: Same as cycle 21 (architecture, build system, UI concerns)