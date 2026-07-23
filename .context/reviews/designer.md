# Cycle 5 — Designer / UI-UX Reviewer

**Date:** 2026-07-23
**Review target:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`
**Mode:** complete static UI/accessibility audit plus a partial isolated live-browser pass

## Coverage and reviewer recovery

The review inventoried `apps/web/src/app.css`, the shared layout, all five page
entries, all 14 Svelte components under `components/cards`,
`components/dashboard`, `components/report`, `components/ui`, and
`components/upload`, the public scripts, relevant store/card helpers, and
shipped card-detail data.

The primary designer launched the production build on isolated port `43173`
with the sole agent-browser session `c5-designer-e3aa-20260723`. That agent
stalled during report finalization, then stalled again on the one permitted
retry. The coordinator therefore recovered the completed static subreview
below rather than inventing missing live evidence. The exact browser session
and attributable preview PID were closed; port `43173`, the session list, and
the repository E2E ownership check were clean afterward. Findings that still
need live or assistive-technology confirmation say so explicitly.

## Findings

### D5-01 — Parent category choices are indistinguishable after selection

- **Severity:** High
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/components/dashboard/TransactionReview.svelte:26-41,89-104,298-314`

Every parent option is labeled `전체`. A native select shows only the selected
option text when closed, not its surrounding optgroup label, so selecting
외식, 식료품, or 대중교통 leaves the control displaying the same `전체` value.
Users cannot verify the classification they assigned. Label parent options
with their group, such as `외식 전체`.

### D5-02 — Fallback category editing writes a malformed hierarchy

- **Severity:** High
- **Confidence:** High
- **Status:** confirmed statically; duplicates C5-CT-002
- **Location:** `apps/web/src/components/dashboard/TransactionReview.svelte:26-58,71-117,177-200`

The fallback options contain qualified subcategory IDs, but both fallback
branches omit the subcategory-to-parent map. Selecting `dining.cafe` can
therefore persist it as a top-level category. Build all fallback taxonomy
state through one helper.

### D5-03 — Analysis options remain editable after the running analysis snapshots them

- **Severity:** High
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/components/upload/FileDropzone.svelte:301-319,528-637`

`analyze()` snapshots bank and previous-spending values at start, while the
bank buttons and amount input remain enabled throughout the upload state.
Changing either control then shows a value that the running result did not
use. Disable the option fieldset while busy or cancel and restart analysis
when those values change.

### D5-04 — Correcting a filtered transaction can discard keyboard focus

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically; live focus restoration should be tested
- **Location:** `apps/web/src/components/dashboard/TransactionReview.svelte:149-200,298-314`

With `미분류만 보기` enabled, changing a row to a normal category and
confidence `1.0` immediately removes the keyed row and its focused select from
the DOM. Retain the edited row until focus leaves or move focus deliberately
to the next row or apply control.

### D5-05 — The horizontally scrollable transaction table is not keyboard-operable as a region

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/components/dashboard/TransactionReview.svelte:272-275`

The narrow-screen table uses `overflow-x-auto` and `min-w-max` but has no
focusability, accessible region name, focus indicator, or scroll hint. The
card-detail table already demonstrates the expected labeled-region pattern.
Add a labeled `role="region"`, `tabindex="0"`, visible focus treatment, and a
narrow-screen hint.

### D5-06 — Category selects are temporarily empty while taxonomy data loads

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/components/dashboard/TransactionReview.svelte:10-22,71-119,298-314`

Category groups start empty and populate only after mount, while selects remain
enabled. Expanding the review immediately can expose blank controls. Seed the
state synchronously from fallback groups or expose a disabled loading state.

### D5-07 — Card-detail exclusions expose raw internal identifiers

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed against shipped data
- **Location:** `apps/web/src/components/cards/CardDetail.svelte:374-383`; `apps/web/src/lib/cards.ts:494-503`

Exclusions such as `tax_payment`, `utility_bills`, `apartment_mgmt`, and
`gift_card` are rendered verbatim in an otherwise Korean interface. Map known
identifiers to localized labels and provide a readable fallback.

### D5-08 — Summary-tile text fails normal-text contrast in light mode

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed against the installed Tailwind palette
- **Location:** `apps/web/src/components/dashboard/SpendingSummary.svelte:103,119,149,193-195`

Blue-400 on blue-50/100 is about 2.42/2.16:1, amber-400 on amber-50/100 about
1.66/1.54:1, purple-500 on purple-50/100 about 3.84/3.48:1, and the 12 px
amber-500 dismiss action on amber-50 about 2.07:1. These are below WCAG 1.4.3's
4.5:1 normal-text threshold. Use verified 700-level foregrounds or semantic
tokens.

### D5-09 — Inactive upload-step numbers fail text contrast in both themes

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/components/upload/FileDropzone.svelte:403-408`; `apps/web/src/app.css:23-24,58-59`

Inactive 12 px numbers use `--color-text-muted` on `--color-border`, producing
about 3.86:1 in light mode and 4.04:1 in dark mode. Use a dedicated foreground
or higher-contrast circle background.

### D5-10 — The upload retry action has insufficient dark-mode contrast

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/components/upload/FileDropzone.svelte:656-661`; `apps/web/src/app.css:56`

The retry button fixes `text-red-700` on the dark surface `#1e293b`, about
2.26:1. Add a dark-mode foreground and verify hover/focus states.

### D5-11 — Upload workflow transitions lose focus and announce status unreliably

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically; announcement timing should be AT-tested
- **Location:** `apps/web/src/components/upload/FileDropzone.svelte:247-275,330-356,382-386,455-523,615-631,656-661`

The focused file input and remove, clear, or retry controls can delete
themselves without a focus destination. Progress live markup is conditional
inside a disabled submit button, and the success branch has no status role
before automatic navigation 1.2 seconds later. Keep a persistent external live
region, restore focus after branch changes, and provide a deliberate dashboard
transition.

### D5-12 — Persisted-result pages initially render a false empty state

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically; layout shift should be measured live
- **Location:** `apps/web/src/pages/dashboard.astro:37-52`; `apps/web/src/pages/results.astro:35-50`; `apps/web/src/pages/report.astro:47-62`; `apps/web/src/components/ui/VisibilityToggle.svelte:64-84`

The server output shows the empty state and hides data until hydration reverses
the branches. Returning users can briefly see `아직 분석 결과가 없어요` before
the result replaces it, and errors collapse into the same binary state. Render
a stable readiness shell and distinguish loading, error, no-data, and data.

### D5-13 — Printed results retain navigation and interactive-only controls

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/pages/results.astro:16-25,90-131`; `apps/web/src/components/dashboard/OptimalCardMap.svelte:62-79`; `apps/web/src/components/dashboard/SavingsComparison.svelte:263-276`; `apps/web/src/app.css:166-175`

The results print action leaves back/action links, sorting pills, and a details
toggle in the PDF. Mark the interactive controls print-hidden and decide
whether useful collapsed content expands for print.

### D5-14 — The previous-spending field advertises a format the control does not accept reliably

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed statically; comma behavior varies by browser
- **Location:** `apps/web/src/components/upload/FileDropzone.svelte:582-599`

A native `type="number"` field shows the example `500,000`, although localized
separators are not valid number input in common browsers. Any keystroke also
clears an existing validation message without revalidating. Use an ungrouped
example or normalized text input and keep touched-field validation current.

### D5-15 — Bottom pagination leaves users below the replaced result page

- **Severity:** Medium
- **Confidence:** Medium-high
- **Status:** confirmed statically; viewport behavior should be tested live
- **Location:** `apps/web/src/components/cards/CardGrid.svelte:172-174,434,481`

Both pagers only change state. Activating the bottom `다음` control replaces
cards above the viewport without moving scroll or focus to the new results.
Focus a results landmark or first card and scroll with reduced-motion
preferences respected.

### D5-16 — Dark mode does not declare a native-control color scheme

- **Severity:** Medium
- **Confidence:** Medium-high
- **Status:** confirmed omission; rendering impact is browser-dependent
- **Location:** `apps/web/src/app.css:54-74`; `apps/web/public/layout.js:21-29`

Dark tokens and the `.dark` class change custom styling, but no
`color-scheme: dark` is declared. Native selects, checkboxes, option popups,
and autofill affordances can remain light. Declare root light and dark color
schemes and verify forced-colors behavior.

### D5-17 — Theme toggles expose neither current state nor resulting action

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/layouts/Layout.astro:110-137`; `apps/web/public/layout.js:13-29`

Both controls retain the fixed accessible name `테마 전환`; script changes
only icons and classes. Synchronize `aria-pressed` and action-specific Korean
labels for light and dark state.

### D5-18 — Results-page savings content has no navigable section heading

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/pages/results.astro:71-77`; `apps/web/src/components/dashboard/SavingsComparison.svelte:142-341`

The results page embeds the savings comparison without a heading, so heading
navigation skips the entire section. Add an outer `h2` or an optional component
heading.

### D5-19 — Noninteractive panels animate like clickable cards

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/app.css:129-136`; `apps/web/src/pages/index.astro:93,104,115`; `apps/web/src/pages/dashboard.astro:57,71,87,106`

`card-transition` lifts and shadows noninteractive feature and dashboard
panels on hover, suggesting activation where none exists. Reserve the lift for
interactive elements or use a neutral panel treatment.

### D5-20 — “Same issuer” navigation discards the issuer context

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed statically
- **Location:** `apps/web/src/components/cards/CardDetail.svelte:388-410`

The section says `같은 카드사의 다른 카드` but links to the unfiltered card
catalog. Encode the current issuer in the existing card-grid query state or
change the copy.

## Final status

Twenty raw findings survived the completed static sweep. D5-02 independently
duplicates the critic's fallback-taxonomy defect; the other 19 are distinct.
No source, plan, generated artifact, git state, or protected Cycle 42 artifact
was changed by the reviewer.
