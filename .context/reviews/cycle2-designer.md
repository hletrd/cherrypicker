# Cycle 2 Designer Review — UI/UX

## Scope
This repo has a web frontend in `apps/web/`. Reviewing UI/UX aspects relevant to the parser diversity goal.

---

## F-DES-01: Parser error messages are technical, not user-friendly
**Severity: Low | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts` line 79, `xlsx.ts` line 439

Error messages like "금액을 해석할 수 없습니다: {amountRaw}" and "날짜를 해석할 수 없습니다: {raw}" are in Korean which is appropriate, but they show raw CSV/XLSX data that normal users won't understand. A more user-friendly message could explain what went wrong and how to fix it (e.g., "이 파일의 형식을 인식할 수 없어요. CSV 파일로 다시 내보내 주세요.").

---

## F-DES-02: No loading/progress feedback for large file parsing
**Severity: Low | Confidence: Medium**

The parser runs synchronously in the browser (CSV) or asynchronously (XLSX, PDF). For large files, there's no progress indication. The PDF parser in particular can be slow due to pdfjs-dist processing. Users may think the app is frozen.

---

## F-DES-03: The web app correctly shows detected bank name
**Status: PASS**
The FileDropzone component shows the auto-detected bank name (per commit 570eac1), which helps users verify the parser is using the right bank adapter.

---

## No other UI/UX issues found related to parser functionality.
The parser operates server-side or in-browser before results are displayed. The UI correctly shows transaction results, error messages, and bank detection. Focus/keyboard navigation and visual design are outside the scope of this parser-focused review cycle.