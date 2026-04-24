# Cycle 4 — Verifier (Evidence-Based Correctness Check)

**Date:** 2026-04-24
**Reviewer:** verifier
**Scope:** Full repository

---

## C4-V01: SavingsComparison.svelte line 321 uses raw BASE_URL — C3-05 fix incomplete (verified)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:321`
- **Evidence:** Grep for `import.meta.env.BASE_URL` across Svelte components confirms `SavingsComparison.svelte:321` and `SpendingSummary.svelte:180` still use the raw pattern. The C3-05 commit (`8b8d72e`) message says "replace raw import.meta.env.BASE_URL with buildPageUrl()" but the SavingsComparison empty-state branch was not updated. Verified by reading the current file content.
- **Verdict:** Confirmed incomplete fix.

## C4-V02: SpendingSummary.svelte line 180 uses raw BASE_URL — not in C3-05 scope (verified)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SpendingSummary.svelte:180`
- **Evidence:** Same grep results. This component was never listed in C3-05's scope (which covered ReportContent, CategoryBreakdown, OptimalCardMap).
- **Verdict:** Confirmed — missed component.

## C4-V03: TransactionReview.svelte table headers lack scope="col" — C3-04 fix incomplete (verified)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:276-280`
- **Evidence:** Grep for `<th ` in Svelte files confirms all 5 TransactionReview `<th>` elements lack `scope="col"`. The C3-04 commit (`49abe71`) added scope to OptimalCardMap, SavingsComparison breakdown, and ReportContent but not TransactionReview.
- **Verdict:** Confirmed incomplete fix.

## C4-V04: ReportContent summary table uses td instead of th scope="row" for row labels (verified)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/report/ReportContent.svelte:36-59`
- **Evidence:** Read the file. Lines 36, 40, 44, 48, 54, 58 all use `<td class="px-4 py-3 font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)]">` for what are semantically row header cells. Per WCAG 1.3.1, these should be `<th scope="row">`.
- **Verdict:** Confirmed structural accessibility issue.

---

## Final Sweep

All findings are verified with grep evidence or direct file inspection. No unverified claims.
