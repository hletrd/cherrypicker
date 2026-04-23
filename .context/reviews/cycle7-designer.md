# Cycle 7 — designer

Focus: sanity-check cycle-6 UI/UX fixes (beforeunload guard, ARIA stepper, overflow-x-auto at 320px, contrast) via code inspection. Live browser verification deferred unless flagged.

## Cycle-6 fix verification (code-only)

### V-01 — beforeunload guard (C6UI-16)

- Source: `apps/web/src/components/upload/FileDropzone.svelte:240-245, :251, :285`.
- Evidence: `beforeUnloadGuard` returns a message; installed at line 251 (after `uploadStatus = 'uploading'`); removed at line 285 in `finally`.
- Verdict: code-correct. Live browser would show native "leave site?" prompt during the ~1-2s upload window. Cannot be deterministically e2e tested because browsers intentionally gate `beforeunload` behind a user-gesture heuristic; unit test via synthetic event is the best option (see test-engineer coverage gap).

### V-02 — ARIA stepper (C6UI-02)

- Source: FileDropzone.svelte:302-341.
- Evidence: uses `<ol>` with `aria-label="업로드 단계"`, each `<li>` has `aria-current={isActive ? 'step' : undefined}`. No `role="progressbar"`. Matches WAI-ARIA APG pattern.
- Verdict: correct. VoiceOver/NVDA should announce "list, 업로드 단계, 4 items, current step: 파일 선택".

### V-03 — Overflow-x-auto at 320px (C6UI-26)

- Source: TransactionReview.svelte:265-266.
- Evidence: `<div class="max-h-[400px] overflow-x-auto overflow-y-auto">` wraps `<table class="w-full min-w-max text-xs">`. The `min-w-max` keeps the table at its natural width, so narrow viewports scroll horizontally.
- Verdict: correct. At 320px, table will overflow and allow swipe-scroll.

### V-04 — Contrast updates (C6UI-22, C6UI-31)

- Source: SavingsComparison.svelte:218-220 (text-blue-600 instead of text-blue-500 — passes AA 4.5:1), and FileDropzone.svelte:364-367 (text-green-700 on white passes AA 5.09:1).
- Verdict: correct per WCAG ratios called out in comments.

## New findings this cycle

### D7-01 — `minute` text shown during savings animation can read "+0 / -0" inconsistently [LOW / Medium]

- File: `SavingsComparison.svelte:244`.
- Evidence: `formatSavingsValue(displayedSavings, opt.savingsVsSingleCard)` — the second arg is the FINAL target sign, not the animated intermediate. During animation from 0 to a positive value, displayedSavings is transiently near 0 while the target sign is positive, so the label "+원" flashes briefly. Actually the fix at :241-243 explains the current behaviour uses unconditional abs(). Looks OK.
- Fix: defer unless regression observed.

### D7-02 — `색 표시기` issuer pills have low contrast on some issuer colors [LOW / Medium]

- File: `formatters.ts` `getIssuerColor` + `getIssuerTextColor`.
- Evidence: not re-read this cycle. If issuer colors are pastel with white text, contrast may fail.
- Fix: audit `getIssuerTextColor` to ensure it picks `text-white` only when background is dark enough (≥ 4.5:1 against white) and `text-gray-900` otherwise.

### D7-03 — `아직 분석 결과가 없어요` appears in two places with different CTA copy [LOW / Low]

- File: `dashboard.astro:36` and `SavingsComparison.svelte:318` and `OptimalCardMap.svelte:173`.
- Evidence: the empty copy "아직 분석 결과가 없어요" (dashboard page), "아직 비교 데이터가 없어요" (SavingsComparison), "아직 추천 결과가 없어요" (OptimalCardMap). Inconsistent tone but each is context-appropriate.
- Fix: none, intentional.

### D7-04 — 전체 삭제 button lacks destructive styling [LOW / Low]

- File: `FileDropzone.svelte:401-406`.
- Evidence: the `전체 삭제` button hovers red but base state is muted. Clicking removes all files without confirmation. Acceptable because the data isn't in the store yet, but user might click by accident.
- Fix: defer — low risk, one-click UX is more valuable than a confirm.

### D7-05 — Loading spinner under `분석하는 중` has no `aria-busy` [LOW / Medium]

- File: `FileDropzone.svelte:498-505`.
- Evidence: the spinner SVG is decorative (`fill="none"`, no aria-hidden). Screen readers announce the text "분석하는 중" which is fine, but the submit button is still announced as `button` — the AT user doesn't know it's disabled.
- Fix: add `aria-busy="true"` on the button while `uploadStatus === 'uploading'`.

### D7-06 — Stepper `text-green-700` on completed steps passes AA but depends on Tailwind 4 color token [LOW / Low]

- File: FileDropzone.svelte:327.
- Evidence: ok.
- Fix: none.

## Summary

Cycle-6 fixes are code-correct. One new LOW item (D7-05 aria-busy) is cheap to land this cycle. Others are defer-able.
