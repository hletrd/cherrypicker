# Plan 22 — High-Priority Fixes (Cycle 13)

**Priority:** HIGH
**Findings addressed:** C13-01, C13-02, C13-16
**Status:** DONE

---

## Task 1: Fix CSV short-year date zero-padding (C13-01)

**Finding:** `apps/web/src/lib/parser/csv.ts:54` — When parsing a short-year date (YY-MM-DD), the CSV parser outputs `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[3]}` without padding the month/day. The XLSX version correctly uses `padStart(2, '0')`. This produces non-ISO dates like "2024-1-5" instead of "2024-01-05", which breaks month extraction via `tx.date.slice(0, 7)` downstream.

**File:** `apps/web/src/lib/parser/csv.ts`

**Implementation:**
1. Change line 54 from:
```ts
return `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[3]}`;
```
to:
```ts
return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
```

**Commit:** `fix(parser): 🐛 add zero-padding to CSV short-year date parsing`

---

## Task 2: Fix PDF short-year date zero-padding (C13-02)

**Finding:** `apps/web/src/lib/parser/pdf.ts:150` — Same issue as C13-01 but in the PDF parser. The short-year branch outputs `${fullYear}-${shortMatch[2]}-${shortMatch[3]}` without padding.

**File:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**
1. Change line 150 from:
```ts
return `${fullYear}-${shortMatch[2]}-${shortMatch[3]}`;
```
to:
```ts
return `${fullYear}-${shortMatch[2]!.padStart(2, '0')}-${shortMatch[3]!.padStart(2, '0')}`;
```

**Commit:** `fix(parser): 🐛 add zero-padding to PDF short-year date parsing`

---

## Task 3: Fix "전전월" → "전월" in FileDropzone help text (C13-16)

**Finding:** `apps/web/src/components/upload/FileDropzone.svelte:401` — The help text says "여러 달 업로드 시 전전월 실적이 자동으로 사용돼요" (two months ago). But the actual logic in `analyzer.ts:269` uses the second-to-last month relative to the latest month, which is the *전월* (previous month), not 전전월 (two months ago).

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Implementation:**
1. Change line 401 from:
```svelte
<p class="mt-1 text-xs text-[var(--color-text-muted)]">여러 달 업로드 시 전전월 실적이 자동으로 사용돼요. 직접 입력하면 덮어써요.</p>
```
to:
```svelte
<p class="mt-1 text-xs text-[var(--color-text-muted)]">여러 달 업로드 시 전월 실적이 자동으로 사용돼요. 직접 입력하면 덮어써요.</p>
```

**Commit:** `fix(web): 🐛 correct 전전월 to 전월 in multi-month upload help text`

---

## Progress

- [x] Task 1: Fix CSV short-year date zero-padding — Committed (0000000a7)
- [x] Task 2: Fix PDF short-year date zero-padding — Committed (0000000a7)
- [x] Task 3: Fix "전전월" → "전월" in FileDropzone help text — Committed (0000000a7)
