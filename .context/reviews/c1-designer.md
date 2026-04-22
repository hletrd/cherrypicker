# Designer Review -- Cycle 1 (2026-04-22)

## UI/UX Findings

### DN-01: KakaoBank issuer badge fails WCAG AA contrast
- **File**: `apps/web/src/lib/formatters.ts:127`
- **Problem**: The KakaoBank issuer color is `#fee500` (bright yellow). When used as badge background with white text (SavingsComparison.svelte:196-199, CardDetail.svelte:135-137), the contrast ratio is approximately 1.7:1, far below the WCAG AA minimum of 4.5:1.
- **Failure scenario**: Users with visual impairments cannot read "KAKAO" text on the yellow badge. On bright monitors in daylight, the text is nearly invisible.
- **Suggested fix**: Use dark text (#1a1a1a) on the KakaoBank yellow background, or darken the yellow to meet WCAG AA with white text.
- **Confidence**: High (calculable contrast failure, 94+ cycles flagging)

### DN-02: CategoryBreakdown CATEGORY_COLORS poor dark mode contrast
- **File**: `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-84`
- **Problem**: Several category colors (e.g., `electricity: '#facc15'`, `cafe: '#92400e'`, `insurance: '#a78bfa'`) have insufficient contrast against the dark mode background. The bar opacity is further reduced to 0.8 (line 231), worsening the issue.
- **Failure scenario**: In dark mode, the "electricity" bar (#facc15 at 0.8 opacity on dark background) and "cafe" bar (#92400e at 0.8 opacity on dark background) are barely distinguishable.
- **Suggested fix**: Define separate dark mode color palettes, or increase opacity to 1.0 in dark mode.
- **Confidence**: Medium (subjective, but measurable contrast ratios confirm the issue)

### DN-03: TransactionReview table overflows on mobile
- **File**: `apps/web/src/components/dashboard/TransactionReview.svelte:262`
- **Problem**: The transaction table has 5 columns (date, merchant, amount, category, confidence) in a fixed layout. On screens narrower than 640px, the table either overflows or compresses columns to unreadable widths. The `max-h-[400px]` vertical scroll helps, but horizontal scroll is not enabled.
- **Failure scenario**: On a 375px-wide phone, the table columns are compressed. The merchant name (which can be long Korean text) is not truncated, pushing other columns off-screen.
- **Suggested fix**: Add `overflow-x-auto` to the table container, or switch to a card-based layout on mobile.
- **Confidence**: High (standard mobile responsiveness issue)

### DN-04: SpendingSummary month label formatting edge case
- **File**: `apps/web/src/components/dashboard/SpendingSummary.svelte:137-151`
- **Problem**: The "전월실적" label computation (lines 139-147) uses inline `{@const}` calculations in the template. When `monthDiff` is NaN (from invalid date strings), the fallback label is "이전 실적" which is reasonable. But the computation is complex and hard to follow in the template.
- **Failure scenario**: A date string like "2024-13-01" (invalid month) would produce NaN for monthDiff, falling back to "이전 실적" which is correct but not informative.
- **Suggested fix**: Move the label computation to a `$derived` variable in the script section for readability and testability.
- **Confidence**: Low (cosmetic, not a functional issue)

### DN-05: No empty state illustration or guidance after analysis reset
- **File**: `apps/web/src/components/dashboard/SavingsComparison.svelte:312-325`
- **Problem**: After the store is reset, the SavingsComparison shows a dashed-border box with text and a link. The icon (`banknotes`) is at 40% opacity and small (size=40). The empty state feels minimal and doesn't clearly communicate what to do next.
- **Failure scenario**: New users who reset their analysis see a sparse empty state with no visual hierarchy. The CTA "명세서 올리러 가기" is easy to miss among the gray text.
- **Suggested fix**: Increase icon size and opacity, add a subtle background color, and make the CTA more prominent.
- **Confidence**: Low (subjective design improvement)

### DN-06: Category select dropdown has no search/filter
- **File**: `apps/web/src/components/dashboard/TransactionReview.svelte:294-300`
- **Problem**: The category dropdown uses `<optgroup>` with all categories and subcategories. With 40+ options grouped by parent category, finding the right category requires scrolling through the entire list.
- **Failure scenario**: A user wants to change a transaction's category to "주유" (fuel). They must scroll through 6 groups to find the "교통/주유" group, then select "주유". This is tedious with many categories.
- **Suggested fix**: Replace the native `<select>` with a searchable dropdown component, or add a typeahead filter.
- **Confidence**: Medium (usability improvement, not a bug)
