# Cycle 31 Designer (UI/UX) Review

**Scope:** Web frontend components, accessibility, responsive design, and user-facing parser feedback.

---

## New Findings

### C31-UI01 | LOW | Medium | `apps/web/src/components/upload/FileDropzone.svelte`

**Parser error messages are technical and not actionable**

When a parser fails (e.g., `금액을 해석할 수 없습니다: ${amountRaw}`), the raw amount is shown as-is, which may be a garbled string. Users don't know what to do with this information. The error list in the UI should suggest actionable next steps (e.g., "Check if the file format matches your bank" or "Try exporting as CSV instead").

**Fix:** Add user-friendly error messages with suggested actions.

### C31-UI02 | LOW | Low | `apps/web/src/components/dashboard/TransactionReview.svelte`

**Category change dropdown lacks loading state during reoptimization**

When the user changes a transaction category, `reoptimize()` is called. If the user's card selection is large, this may take 500ms+. There is no visual feedback during this operation, making the UI feel unresponsive.

**Fix:** Add a temporary loading indicator or disable the dropdown during reoptimization.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| C25-01 | FIXED | CATEGORY_COLORS utility subcategories now high-contrast |
| C25-09 | FIXED | CardDetail performance tier header now uses consistent dark mode colors |
| C19-04 | OPEN (LOW) | FileDropzone still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | CardDetail still uses `window.location.href` for navigation |
| C18-03 | OPEN (LOW) | SavingsComparison annual projection still multiplies by 12 |

---

## Final Sweep

1. All interactive elements have focus states (Tailwind `focus:` classes)
2. Dark mode classes present on all reviewed components
3. `prefers-reduced-motion` handled globally in app.css
4. Form validation provides immediate feedback
5. No new accessibility regressions detected
