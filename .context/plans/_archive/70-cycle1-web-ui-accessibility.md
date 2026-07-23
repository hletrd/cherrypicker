# Cycle 1 Web Correctness, UI, and Accessibility Plan

**Archived:** 2026-07-23 after recorded product/browser acceptance; harness deferral remains in the plan
**Status:** Product implementation and browser verification complete; dedicated Svelte component harness explicitly deferred
**Date:** 2026-07-23
**Deploy mode:** None — do not deploy
**Scope:** C1-026 through C1-034 and C1-045 through C1-060
**Source reviews:** `.context/reviews/_aggregate.md`, `.context/reviews/designer.md`, `.context/reviews/debugger.md`, `.context/reviews/code-reviewer.md`, and `.context/reviews/document-specialist.md`

## Outcome

Make the browser application trustworthy and operable across failed data loads, partial parses, keyboard/screen-reader use, dark mode, narrow screens, reduced motion, and print. This plan schedules all 25 assigned findings. No correctness or accessibility High is deferred, and no assigned Medium/Low finding is silently dropped.

The implementation must:

- reject an unavailable/empty card catalog instead of returning a plausible zero-reward analysis;
- render catalog reward values and performance tiers using their actual data contract;
- expose partial-analysis warnings, form validation, loading, warning, and retry states;
- use valid native interaction and table semantics;
- meet WCAG 2.2 AA contrast and reduced-motion requirements;
- keep core comparisons readable at 320–400 CSS px and 200% zoom;
- produce theme-independent print output;
- test production helpers/components and the built application;
- preserve all pre-existing dirty work and review artifacts;
- start and end each E2E batch without a repository-owned preview, Playwright, Chromium, or Chrome process left behind.

## Non-goals

- Do not deploy or run any deploy/publish/release command.
- Do not reset, stash, discard, or reformat unrelated dirty files.
- Do not modify `.context/reviews/**`.
- Do not fold C1-043/C1-044 catalog pagination or parser-bundle splitting into this plan. C1-026 changes the correctness of the existing loader, not the catalog payload architecture.
- Do not kill the user's `/Applications/Google Chrome`, the unrelated Travelback agent-browser session, or any process whose repository ownership cannot be proven.
- Do not satisfy tests by copying production logic into test files, weakening assertions, suppressing diagnostics, or changing expected behavior to match a defect.

## Baseline and ownership guardrails

Before editing:

1. Capture `git status --short`, `git diff --name-only`, and `git diff -- apps/web/src/lib/store.svelte.ts` to a temporary location outside the repository. `store.svelte.ts`, the amount parser/test, cycle-42 reviews, and other review files are already dirty and belong to existing work.
2. Record hashes for every dirty `.context/reviews/**` file. Those hashes must be unchanged at handoff.
3. Read the current diff before touching an overlapping file. Apply narrow patches around the existing work; never replace the whole file.
4. Use `apply_patch` for manual edits. Formatting tools may make mechanical changes only within the intended file set.
5. Keep each test independent. A failed test batch must be recorded and cleaned up, then the next independent batch must still run; one failure must not leave Chrome running or stop collection of the remaining gate results.

Expected production/test file set:

- `apps/web/src/lib/cards.ts`
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/lib/formatters.ts`
- `apps/web/src/lib/api.ts` only if its error contract needs propagation
- new focused helpers under `apps/web/src/lib/` for upload validation, supported formats, and print state
- `apps/web/src/components/upload/FileDropzone.svelte`
- `apps/web/src/components/cards/CardGrid.svelte`
- `apps/web/src/components/cards/CardDetail.svelte`
- `apps/web/src/components/cards/CardPage.svelte`
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte`
- `apps/web/src/components/dashboard/SavingsComparison.svelte`
- `apps/web/src/components/dashboard/OptimalCardMap.svelte`
- `apps/web/src/components/report/ReportContent.svelte`
- `apps/web/src/components/ui/VisibilityToggle.svelte`
- new shared UI components for analysis warnings, issuer presentation, and accessible table scrolling if the implementation uses them
- `apps/web/src/layouts/Layout.astro`
- `apps/web/src/pages/index.astro`
- `apps/web/src/pages/dashboard.astro`
- `apps/web/src/pages/results.astro`
- `apps/web/src/pages/report.astro`
- `apps/web/src/app.css`
- `apps/web/public/scripts/layout.js`
- `apps/web/public/icon.svg` or the favicon reference, not both unless both assets are intentionally required
- `README.md` and `packages/parser/src/index.ts` for supported-format contract text
- production-linked web unit/component tests and `e2e/*.spec.js`
- test configuration/manifests and `bun.lock` only if the component-test harness requires explicit dependencies
- this plan for implementation progress

Any source file outside that set requires a written scope note in this plan before it is changed.

## Browser and E2E process protocol

These steps are mandatory before and after **every** Playwright/E2E batch.

### Before a batch

1. Inspect the fixed port without mutating anything:

   ```sh
   lsof -nP -iTCP:4173 -sTCP:LISTEN
   ```

2. For every returned PID, resolve command, parent/process group, start time, and working directory:

   ```sh
   ps -o pid=,ppid=,pgid=,lstart=,command= -p <PID>
   lsof -a -p <PID> -d cwd
   ```

3. Inspect candidate Playwright/Chromium/Chrome processes with `ps`, but do not use broad `pkill`, `killall`, name-only matching, or a glob. A process is repository-owned only when its ancestry/working directory points to this checkout or its temporary browser profile was recorded from this batch.
4. If a stale process is proven to belong to this repository, send `TERM` to its exact preview runner/browser root/process group, wait briefly, re-check, and use `KILL` only for the exact still-live owned PID. Never signal:

   - `/Applications/Google Chrome`;
   - an agent-browser daemon/profile serving Travelback;
   - an unrelated checkout's Playwright tree;
   - any process whose ownership is ambiguous.

5. Verify port 4173 has no listener before starting.
6. Run Playwright with `CI=1` so `reuseExistingServer` is false and the configured runner owns its preview:

   ```sh
   CI=1 bun run test:e2e
   ```

   Record the shell PID/process group and any Playwright-created temporary profile paths as soon as the batch starts.

### After a batch, including a failed or interrupted batch

1. Capture the test exit code and logs first.
2. Re-run the listener/process inspection. Terminate only the exact preview/browser roots and descendants recorded for this batch.
3. Verify that the recorded temporary profile has no live process and TCP 4173 has no listener.
4. Report preserved external browsers separately. Their presence is not a cleanup failure.
5. If the batch failed, continue with non-browser gates and any remaining independent E2E project/spec batches after cleanup. Do not interpret one E2E failure as permission to stop the whole cycle.

Acceptance for lifecycle hygiene: after each batch, `lsof -nP -iTCP:4173 -sTCP:LISTEN` is empty and no process using that batch's recorded profile remains.

---

## Implementation sequence

### 1. Make card-data loading fail explicitly and isolate caller cancellation

**Findings:** C1-026 (High, High)

**Current locations**

- `apps/web/src/lib/cards.ts:90-184`
- `apps/web/src/lib/cards.ts:225-264`
- `apps/web/src/lib/analyzer.ts:191-218`
- `apps/web/src/lib/analyzer.ts:264-280`
- `apps/web/src/components/cards/CardGrid.svelte:86-93`
- `apps/web/src/components/cards/CardDetail.svelte:86-105`

**Changes**

- [x] Change the cached card-data promise to resolve only with valid `CardsJson`; it must never encode timeout/cancellation as `undefined`.
- [x] Remove the behavior where a component caller's `AbortSignal` aborts the shared underlying fetch. Keep one internal controller for the fetch/timeout and race each caller's await against only that caller's signal.
- [x] Remove per-caller abort listeners in `finally` so repeated mounts do not leak listeners.
- [x] Distinguish internal timeout from caller cancellation. An internal timeout/network/HTTP/JSON failure must reject with a localized actionable data-unavailable error; an individual caller abort remains an `AbortError` visible only to that caller.
- [x] Clear timeout handles on success and every failure path, reset a failed cache so retry starts a fresh fetch, and build the card index only from a validated successful response.
- [x] Apply the same cancellation primitive to `loadCategories`, because the existing `chainAbortSignal` is shared and leaving it in place would preserve the same cross-caller hazard for analysis.
- [x] Make `getAllCardRules`, `getCardList`, and `getCardById` propagate genuine load failures. Do not convert them to `[]`/`null`.
- [x] Reject `meta.totalCards === 0`, no issuer cards, or a transformed `coreRules.length === 0` before calling `greedyOptimize`. A user-selected `cardIds` set that matches no valid card must also produce an explicit selection error, not a zero-reward success.
- [x] Keep unmount cancellation quiet in `CardGrid`/`CardDetail`, but expose genuine failures through the accessible retry states in Step 5.

**Production unit tests**

- Add `apps/web/__tests__/cards-data.test.ts` importing the real loader/helpers.
- Use a controllable production `fetch` mock to prove:

  - two callers share one request;
  - aborting caller A rejects A but caller B still receives the data;
  - internal timeout rejects every waiter and the next call retries;
  - HTTP/JSON failures reject and do not poison the cache;
  - an empty catalog and unmatched explicit card selection cannot reach the optimizer;
  - timers and signal listeners are released.

**Acceptance criteria**

- No data-load failure path returns a successful optimization with zero catalog rules.
- Component unmount cannot cancel analysis or another component's card fetch.
- Retry after a transient failure performs a new request and can succeed.
- All new tests import the production module; no loader implementation is mirrored in test code.

### 2. Render catalog reward values and tier names according to their real contract

**Findings:** C1-027 (Medium, High), C1-031 (Medium, High)

**Current locations**

- `apps/web/src/lib/cards.ts:3-18`
- `apps/web/src/lib/formatters.ts:12-35`
- `apps/web/src/components/cards/CardDetail.svelte:48-79`
- `apps/web/src/components/cards/CardDetail.svelte:190-258`

**Changes**

- [x] Add a production formatter specifically for catalog reward tiers. Do not reuse `formatRate`/`formatPercent`, which correctly expect calculated decimal rates.
- [x] Treat catalog `rate` as already-percent data: `0.7` renders as `0.7%`, not `70.0%`.
- [x] Render non-null fixed benefits using `fixedAmount` and the unit's Korean label. A tier with no supported display signal must render an honest “표시 가능한 혜택 정보 없음,” never `0%`.
- [x] Make `rateColorClass` consume the same catalog-percent interpretation and avoid numeric operations on `null`.
- [x] Rename the table header from “혜택률” to “혜택” when a column can contain percentage, fixed, point, or mileage values.
- [x] Build a `performanceTier.id → label` map from `card.performanceTiers`, group reward rows by the resolved label, and render the label in “적용 실적.”
- [x] Define a clear fallback for an orphan tier ID, include the ID only in diagnostic logging, and show a user-facing “실적 조건 확인 필요” label.

**Production unit/component tests**

- Extend `apps/web/__tests__/formatters.test.ts` with real formatter imports and cases for `0.7%`, whole percentages, fixed won, points/mileage, zero as a legitimate value, `null`, and unsupported units.
- Add a rendered `CardDetail` component test using representative production-shaped card data. Assert that `tier0`/`tier1` are absent from visible text, Korean tier labels are present, fixed benefits are not `0%`, and 0.7 renders as 0.7%.

**Acceptance criteria**

- A known 0.7% catalog tier renders exactly 0.7%, not 70%.
- Fixed-value benefits never render as a false percentage.
- Internal tier IDs are absent from the user-visible reward table.

### 3. Preserve and surface partial-analysis warnings

**Findings:** C1-028 (High, High)

**Current locations**

- `apps/web/src/lib/analyzer.ts:104-168`
- `apps/web/src/lib/analyzer.ts:320-365`
- `apps/web/src/lib/analyzer.ts:462-471`
- `apps/web/src/lib/store.svelte.ts:68-81`
- `apps/web/src/lib/store.svelte.ts:315-343`
- `apps/web/src/components/upload/FileDropzone.svelte:315-355`
- `apps/web/src/pages/dashboard.astro:29-51`
- `apps/web/src/pages/results.astro`
- `apps/web/src/pages/report.astro`

**Changes**

- [x] Extend the warning contract with stable `fileName`, optional `format`, optional line number, safe message, and a count. Attach file identity while each parse result is still associated with its input; do not flatten anonymous parser errors later.
- [x] Keep fatal “no usable transactions/data unavailable” failures separate from recoverable row warnings.
- [x] Preserve a bounded warning summary in session persistence. Do not reset restored `parseErrors` to `[]`; omit/truncate raw statement text rather than persisting an unbounded `raw` field.
- [x] Add a shared `AnalysisWarnings.svelte` component and render it before decision content on dashboard, results, and report whenever warnings exist.
- [x] Use a visible warning heading and polite status semantics. Summarize affected file/row counts; disclose details with a native button using `aria-expanded` and `aria-controls`.
- [x] Ensure warnings remain visible after client navigation and restoration, and that a clean analysis does not render an empty live region.
- [x] Do not present partial analysis with the same unqualified “완료” message as a clean analysis. Use “분석 완료 — 확인할 항목 있음.”

**Production unit/component/E2E tests**

- Unit-test aggregation with two files and overlapping line numbers, including bounded persistence and restore.
- Render `AnalysisWarnings` with one and multiple files; verify name, count, disclosure state, and safe escaped content.
- Add a malformed-row fixture that still has valid transactions. E2E must prove analysis succeeds, warning is visible with the correct filename/count, and remains visible on dashboard → results → report and after a reload/restore.

**Acceptance criteria**

- No recoverable parser warning is silently discarded.
- The UI differentiates clean success, success-with-warnings, and fatal failure.
- The user can identify which file and row failed without exposing raw markup as HTML.

### 4. Refactor the upload flow as one native, validated interaction

**Findings:** C1-029 (Medium, High), C1-030 (Medium, High), C1-034 (Medium, High), C1-047 (High, High), C1-050 (Medium, High)

**Current locations**

- `apps/web/src/components/upload/FileDropzone.svelte:29-69`
- `apps/web/src/components/upload/FileDropzone.svelte:97-106`
- `apps/web/src/components/upload/FileDropzone.svelte:180-235`
- `apps/web/src/components/upload/FileDropzone.svelte:282-325`
- `apps/web/src/components/upload/FileDropzone.svelte:423-511`
- `apps/web/src/components/upload/FileDropzone.svelte:561-632`
- `README.md:33`
- `apps/web/src/pages/index.astro:58-70`
- `apps/web/src/lib/parser/index.ts:21-100`
- `packages/parser/src/index.ts:32-94`

**Changes**

- [x] Move accepted MIME types/extensions/display names into one production `supported-formats.ts` definition used to build the file input's `accept` value and every upload help/error string.
- [x] Update README and server-parser JSDoc to list CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, and HTML/HTM consistently. Preserve exact extension aliases supported by detection.
- [x] Replace the outer `role="button"`/`tabindex` drop surface with a non-interactive region plus a real, keyboard-focusable native file input/label control. Keep remove/add/clear controls as sibling controls, never descendants of another button.
- [x] Give every removal button the filename in its accessible name.
- [x] Select one drop handler. If document-wide drop remains, remove the child `drop` call or guard it so one bubbling gesture invokes `addFiles` exactly once.
- [x] Keep drag-over feedback visual and in a polite live region without changing the control's role.
- [x] Extract previous-spending parsing/validation into a production helper returning a typed valid/error result. Do not clamp user input.
- [x] Submit analysis through a real form or an explicit equivalent that calls native validity checks. Block negative, non-finite, fractional where disallowed, and over-maximum values.
- [x] Render localized inline error text linked through `aria-describedby`; synchronize `aria-invalid`; focus the invalid field after a submit attempt.
- [x] Keep `errorMessages` for fatal/rejected files and add a separate `warningMessages` state. The 50 MB warning must render as a nonblocking visible `role="status"` while analysis remains available.
- [x] Make status transitions deterministic: adding a valid file must not erase a still-applicable total-size warning; retry must clear only the relevant fatal state; removing files below the threshold removes the warning.

**Production unit/component/E2E tests**

- Unit-test the production format definition and previous-spending validator at all boundaries.
- Render `FileDropzone` and assert:

  - no `[role="button"] button` or nested interactive controls;
  - file input is keyboard focusable and visibly focused;
  - repeated remove buttons have unique accessible names;
  - a single drop adds one file with no false duplicate;
  - 50 MB total produces a visible nonfatal warning;
  - an over-maximum amount blocks submission and is linked to its inline error;
  - supported-format copy is generated from the same definition as `accept`.

- Add built-app E2E for the one-drop behavior, keyboard file control, invalid amount, and nonblocking size warning.

**Acceptance criteria**

- One drop produces one file-list entry and no duplicate error.
- The accessibility tree has no nested buttons/controls.
- `20,000,000,000` cannot start analysis when the maximum is `10,000,000,000`, and the entered value is never silently transformed.
- The 50 MB warning is visible without changing the flow to a fatal-error state.
- All accepted formats and aliases have consistent UI, validation, README, and API text.

### 5. Make card loading/error/retry states perceivable and recoverable

**Findings:** C1-032 (Medium, High)

**Current locations**

- `apps/web/src/components/cards/CardGrid.svelte:86-93`
- `apps/web/src/components/cards/CardGrid.svelte:160-176`
- `apps/web/src/components/cards/CardDetail.svelte:86-121`

**Changes**

- [x] Extract each request into a callable `load`/`retry` function with generation and abort protection.
- [x] Mark the content region `aria-busy="true"` only while its active request is pending and provide concise visually hidden polite loading text.
- [x] Use theme tokens for skeletons and reserve the final block dimensions.
- [x] Render terminal failures with `role="alert"` and a real “다시 시도” button.
- [x] Clear the previous error only when a new request begins; prevent late aborted/stale responses from replacing newer success.
- [x] Keep a genuinely empty catalog distinct from a network failure.

**Production component/E2E tests**

- For grid and detail, fail the first production fetch, verify announced error/retry, retry successfully, and assert stale first responses cannot win.
- Verify dark-theme skeleton computed colors use dark surfaces.
- Route `cards.json` to fail once in E2E and assert recovery without full-page reload.

**Acceptance criteria**

- Loading, failure, retrying, and success are distinguishable visually and to assistive technology.
- A transient fetch failure is recoverable from the page.

### 6. Make dashboard status copy state-driven

**Findings:** C1-033 (Medium, High)

**Current locations**

- `apps/web/src/pages/dashboard.astro:29-48`
- `apps/web/src/components/ui/VisibilityToggle.svelte:55-123`

**Changes**

- [x] Remove the unconditional “분석이 끝났어요.”
- [x] Let the existing store-aware visibility boundary synchronize a stable subtitle/status element with empty, complete, complete-with-warnings, and failure states.
- [x] Avoid a second independent sessionStorage reader or inline script.
- [x] Keep the main heading stable; announce only meaningful state changes, not every reactive stat update.

**Tests and acceptance**

- Component-test the state mapping.
- E2E direct navigation with no data must show only the empty invitation, never “분석이 끝났어요.”
- Successful analysis shows completion, and partial analysis shows the qualified warning completion message.

### 7. Introduce contrast-safe semantic and issuer presentation tokens

**Findings:** C1-045 (High, High), C1-046 (High, High), C1-054 (Medium, High)

**Current locations**

- `apps/web/src/app.css:5-45`
- `apps/web/src/layouts/Layout.astro:58-95`
- `apps/web/src/pages/index.astro:11-28`
- `apps/web/src/lib/formatters.ts:115-153`
- `apps/web/src/components/cards/CardGrid.svelte:193-229`
- `apps/web/src/components/cards/CardDetail.svelte:123-179`
- `apps/web/src/components/dashboard/OptimalCardMap.svelte:92-156`
- `apps/web/src/components/dashboard/SavingsComparison.svelte:267-307`
- `apps/web/src/components/report/ReportContent.svelte:44-130`

**Changes**

- [x] Split fill and foreground roles: for example, primary fill/hover, primary foreground/link, status fill, and status foreground tokens. Define explicit light and dark values.
- [x] Audit every `text-[var(--color-primary)]`, success, warning, and danger use. Keep rich blue/green for fills only when paired with a tested foreground; use contrast-safe foreground tokens for text.
- [x] Ensure focus indicators and interactive boundaries reach 3:1 against adjacent colors.
- [x] Replace unrestricted issuer-colored text with one centralized issuer presentation contract/component.
- [x] Use issuer hue as a decorative swatch/border where the raw brand color cannot be readable. Badges must select a tested foreground/background pair for all 24 issuers in both themes.
- [x] Use the normal semantic link token for the official-card link rather than issuer color.
- [x] Give the hero subtitle/privacy statement a stable contrast surface or fully opaque foreground. The privacy statement must not remain translucent over an uncontrolled gradient.
- [x] Keep information available without color: active filters retain text/state, issuer badges retain issuer names, and charts retain labels/values.

**Production unit/component/E2E tests**

- Add a small production color utility only if needed by runtime presentation; tests may independently compute WCAG relative luminance but must read the actual production token/issuer values.
- Test all foreground/surface pairs:

  - normal text ≥ 4.5:1;
  - large text ≥ 3:1;
  - focus/non-text UI indicators ≥ 3:1.

- Render every issuer badge in both themes and assert its computed pair meets the relevant ratio.
- E2E-check hero text at the gradient's worst anchor, dark nav/links/stats, and status text.

**Acceptance criteria**

- No primary/status foreground cited by C1-045 fails AA in either theme.
- Every issuer name/badge is readable in both themes.
- Hero subtitle and privacy copy meet AA over every point of their rendered background.

### 8. Restore native table and disclosure semantics

**Findings:** C1-048 (High, High), C1-052 (Medium, High)

**Current locations**

- `apps/web/src/components/dashboard/OptimalCardMap.svelte:62-168`
- `apps/web/src/components/dashboard/SavingsComparison.svelte:267-314`
- `apps/web/src/components/cards/CardGrid.svelte:98-158`

**Changes**

- [x] Remove `role="button"` and `tabindex` from recommendation `<tr>` elements.
- [x] Keep native row/cell/header associations and place a real disclosure button in a cell.
- [x] Give each alternatives region a stable unique ID; connect the button with `aria-expanded`/`aria-controls`.
- [x] Include category/card identity in the disclosure name while leaving rate/reward exposed through native table navigation.
- [x] Add `aria-pressed` to recommendation sort buttons and labeled toggle groups for card type and issuer filters.
- [x] Add a persistent visible search label; do not rely on placeholder text.
- [x] Add `aria-expanded`/`aria-controls` to the savings detail disclosure.
- [x] Keep visual selection/focus styling synchronized with semantic state.

**Production component/E2E tests**

- Render populated recommendation data and assert `table > tbody > tr` remains exposed as rows, column headers remain associated, and the only disclosure role is the nested button.
- Keyboard-test Enter/Space on disclosure and verify focus does not jump.
- Assert selected type, issuer, sort, and savings-detail state through ARIA rather than CSS classes.

**Acceptance criteria**

- The accessibility tree exposes data rows under their table and all visible numeric cells remain reachable through table navigation.
- Every toggle/disclosure announces its current state.

### 9. Make navigation and reduced-motion behavior match their semantics

**Findings:** C1-053 (Medium, High), C1-057 (Low, High)

**Current locations**

- `apps/web/src/layouts/Layout.astro:71-156`
- `apps/web/public/scripts/layout.js:40-104`
- `apps/web/src/app.css:47-49`
- `apps/web/src/app.css:102-109`
- `apps/web/src/components/cards/CardPage.svelte:29-39`

**Changes**

- [x] Add `aria-controls` to the mobile menu button and synchronize `aria-expanded` plus “메뉴 열기/메뉴 닫기.”
- [x] Add `aria-current="page"` to the active desktop/mobile link.
- [x] Treat the mobile menu as an inline disclosure: remove the modal-style focus trap, keep focus on the trigger when opened, allow Tab into links, and return focus on Escape close.
- [x] Keep the hidden menu inert and non-tabbable; remove `inert` while open.
- [x] Close on selected navigation and viewport transition without leaving stale expanded state.
- [x] In `prefers-reduced-motion: reduce`, set `scroll-behavior: auto`.
- [x] In `CardPage`, use smooth scrolling only when reduced motion is not requested.

**Tests and acceptance**

- Component/script unit tests cover the open/close attribute synchronizer if extracted.
- E2E tests use keyboard only to open, Tab, Escape, and confirm focus/state/current page.
- With Playwright reduced-motion emulation, computed `scroll-behavior` is `auto` and card selection does not request smooth scrolling.

### 10. Recompose charts and recommendation content for narrow screens

**Findings:** C1-049 (High, High), C1-051 (Medium, High)

**Current locations**

- `apps/web/src/components/dashboard/CategoryBreakdown.svelte:195-265`
- `apps/web/src/components/dashboard/SavingsComparison.svelte:145-186`
- `apps/web/src/components/dashboard/OptimalCardMap.svelte:55-169`

**Changes**

- [x] Replace fixed-width single-row chart layouts with responsive grid areas: label/value in one row and a full-width bar track below on narrow screens.
- [x] Give chart tracks stable test IDs and a meaningful minimum usable width without forcing document overflow.
- [x] Keep exact amount/percentage text visible independently of the bar.
- [x] Provide a mobile recommendation card/list representation below the chosen breakpoint; keep the semantic table for wider screens.
- [x] Do not render duplicate visible/accessibility content at a breakpoint. Use true `display:none` switching and one shared derived assignment model.
- [x] Put category, card, rate, reward, and alternatives disclosure in every mobile item with a logical heading/description order.
- [x] Test long Korean card/category names without character-by-character wrapping.

**Responsive acceptance**

- At 320, 375, and 400 CSS px:

  - category and savings tracks are at least 120 px wide;
  - no category track is 0 px;
  - recommendation names/values remain readable;
  - the document has no unintended horizontal overflow;
  - all actions meet a 44×44 CSS px target or equivalent spacing.

- At 200% zoom, core content reflows without lost values or two-dimensional scrolling.
- Desktop retains the comparison/table density and all semantic changes from Step 8.

### 11. Adapt report/card tables and expose any intentional overflow

**Findings:** C1-056 (Medium, Medium), C1-059 (Medium, Medium)

**Current locations**

- `apps/web/src/components/report/ReportContent.svelte:27-135`
- `apps/web/src/pages/report.astro:55-61`
- `apps/web/src/components/cards/CardDetail.svelte:217-258`

**Changes**

- [x] Use stacked labeled rows/cards for report assignments and per-card breakdown on narrow screens; keep real tables for desktop and print.
- [x] Reduce report container padding responsively.
- [x] For CardDetail's true data table, either provide an equivalent mobile card layout or wrap it in a labeled, keyboard-focusable scroll region with an appropriate minimum table width.
- [x] If horizontal scroll remains, add a visible mobile cue (“표를 좌우로 스크롤할 수 있어요”), an accessible region name, keyboard focus style, and edge treatment. Remove the cue when no overflow exists if practical.
- [x] Never use `overflow-hidden` where it can discard columns.
- [x] Keep screen-only mobile alternatives out of print and preserve print table headers.

**Tests and acceptance**

- Component tests verify labels/cells and scroll-region semantics.
- E2E at 320/375/400 px and keyboard focus verifies no clipped value and discoverable overflow.
- Print-media tests verify desktop table structure remains present and mobile duplicate content is hidden.

### 12. Unify print preparation across results and report

**Findings:** C1-055 (Medium, High)

**Current locations**

- `apps/web/src/pages/results.astro:88-110`
- `apps/web/src/pages/report.astro:67-95`
- `apps/web/src/app.css:88-100`

**Changes**

- [x] Replace the direct results `window.print()` and report-only inline helper with one production print controller used by both routes.
- [x] Before print, switch semantic tokens/content to a light, high-contrast print state and suppress dark variants; after print (including cancel), restore the exact prior theme.
- [x] Make registration idempotent across Astro view transitions and remove listeners on teardown where applicable.
- [x] Define print CSS for descendant surfaces, borders, text, badges, tables, expanded content, and hidden controls—not only body/nav/footer.
- [x] Ensure warning content prints, but interactive disclosure controls and mobile scroll hints do not.

**Tests and acceptance**

- Unit-test the controller's light→print→restore transitions and repeated calls.
- E2E in dark theme stubs the print dialog, dispatches `beforeprint`/`afterprint`, and asserts:

  - print surfaces are white/high-contrast;
  - dark utility styling is inactive;
  - prior dark state is restored;
  - results and report use the same controller.

### 13. Repair the favicon contract

**Findings:** C1-058 (Low, High)

**Current locations**

- `apps/web/src/layouts/Layout.astro:54`
- `apps/web/public/icon.svg`

**Changes and acceptance**

- [x] Point the `<link rel="icon">` at the existing `icon.svg` under the configured base path, or intentionally rename the asset and all references.
- [x] Add a production-preview E2E/request assertion that the resolved favicon URL returns 200 with an SVG content type under `/cherrypicker/`.
- [x] Confirm no page requests `/favicon.svg` unless that file exists.

### 14. Add production-linked unit, component, and E2E coverage

**Findings:** C1-060 (Low, High), plus regression coverage for C1-026–C1-059

**Current locations**

- `e2e/ui-ux-review.spec.js:479-516`
- `e2e/ui-ux-review.spec.js:537-574`
- `e2e/ui-ux-screenshots.spec.js:110-141`
- `e2e/web-regressions.spec.js`
- `apps/web/__tests__/**`
- `vitest.config.ts`
- `apps/web/package.json`

**Test-level contract**

1. **Unit tests:** import production helpers for card loading, reward display, upload validation, supported formats, warning persistence, print state, and any extracted menu state. Do not reproduce those implementations in test code.
2. **Component tests:** render real Svelte components in a DOM-capable Vitest setup. If needed, add a dedicated `apps/web/vitest.component.config.ts`, explicit `@sveltejs/vite-plugin-svelte`, `@testing-library/svelte`, `@testing-library/jest-dom`, and `jsdom` dev dependencies, with component tests outside Bun's `__tests__` discovery. Wire the component command into the web `test` gate.
3. **E2E tests:** run the built Astro application through Playwright, using stable roles/names/test IDs and real CSS geometry.

**Required component suites**

- `FileDropzone`: native structure, one-drop behavior, validation, warnings, unique remove names.
- `CardGrid` and `CardDetail`: loading/error/retry, stale request defense, theme-safe skeleton, reward/tier rendering.
- `AnalysisWarnings`: per-file aggregation, disclosure state, safe output.
- `OptimalCardMap` and `SavingsComparison`: table/disclosure/toggle semantics.
- Issuer presentation and accessible table wrapper/mobile report representation.

**Required E2E assertions**

- [x] Drop one file once; no duplicate alert.
- [x] Upload and analyze a partial-error fixture; warning persists across all result routes.
- [x] Block out-of-range previous spending with associated Korean error text.
- [x] Fail/retry card data without a false empty catalog or page reload.
- [x] Verify native table row/header roles and disclosure state.
- [x] Verify type/issuer/sort/current-page/menu states through ARIA.
- [x] Measure chart tracks and content overflow at 320, 375, and 400 px.
- [x] Exercise keyboard order, Enter/Space, Escape, and focus return.
- [x] Check actual computed contrast for theme/status/issuer/hero pairs.
- [x] Emulate reduced motion.
- [x] Emulate print in light and dark themes.
- [x] Verify report/card table values are not clipped and intentional scroll regions are focusable/labeled.
- [x] Verify favicon 200 and supported-format copy.
- [x] Replace the existing placeholder-as-label assertion with actual accessible-name/associated-label assertions.
- [x] Keep tests independent; do not add file-level serial mode that causes later unrelated tests to be skipped after one failure.

**Acceptance criteria**

- Screenshot assertions supplement but do not replace geometry and accessibility-tree assertions.
- The suite would fail on the original measured regressions: a 0 px category bar, 11 px savings bar, `<tr role="button">`, missing `aria-expanded`, nested upload controls, and failing contrast.
- Component and unit tests exercise imported production code/components rather than copied logic.

---

## Cycle 1 implementation progress

Implemented and verified the assigned production UI slice and production-linked unit/E2E coverage:

- Card/category data requests now isolate caller cancellation, validate nonempty payloads, reject actionable failures, clear failed caches, and support accessible component retry.
- Catalog reward/tier display, upload validation/format contracts, partial-warning presentation, state-driven dashboard copy, semantic color/issuer presentation, native table/disclosure behavior, mobile chart/recommendation/report layouts, reduced motion, shared print preparation, and the favicon reference are implemented.
- Focused production-helper tests pass: 21 passed, 0 failed (`formatters`, `upload-contract`, `cards-loader`).
- The full web unit suite now passes: 238 passed / 0 failed.
- `astro check` passes with 0 errors, 0 warnings, and 0 hints, and the production Astro build passes.
- The completed security helper lane was integrated at its rendering boundary: `CardDetail` now guards outbound catalog URLs, and the shared layout wires the tested frame guard without ineffective security-header meta claims.
- Browser verification ran only through the repository-owned E2E wrapper; each success or failure path completed its scoped cleanup.

### Plan-to-evidence reconciliation (2026-07-23)

| Contract | Production/test evidence | Reconciled state |
|---|---|---|
| Empty catalog and unmatched explicit selection | `analyzer.ts` calls `assertCatalogAvailable` and `assertRequestedCardsResolved` before optimization; `cards.ts` rejects zero-card/no-card-issuer summary artifacts; `analyzer-adapter.test.ts` exercises both boundary helpers. | Implemented; focused unit gate passed. |
| Bounded restored warnings | `persistence.ts` caps warning count and field sizes, strips raw statement content, and restores the bounded summary; `store-persistence.test.ts` exercises a 2,000-warning payload and round-trip restore. | Implemented; focused unit gate passed. |
| Shared loader timeout/retry cleanup | `cards-loader.test.ts` drives the production 10-second timeout with two waiters, checks internal abort/listener/timer cleanup, and verifies the next call retries successfully. | Implemented; focused unit gate passed. |
| Print controller and long Korean names | `print-controller.test.ts` evaluates the shipped `public/scripts/print.js`; `long-name-wrapping.test.ts` locks `break-keep` plus `overflow-wrap:anywhere` against long Korean fixtures. | Implemented; focused unit gate passed. |
| Hero contrast defect found during reconciliation | `index.astro` puts the normal-size white subtitle on a stable `bg-black/40` surface. `plan70-accessibility-regressions.spec.js` computes contrast against every resolved hero-gradient stop. | Product fix and computed browser assertion passed. |
| Required browser assertions | `plan70-accessibility-regressions.spec.js` contains 12 independent tests for one-drop, partial-warning restoration, invalid spend, retry, table/disclosure/filter/menu ARIA, 320/375/400 geometry, keyboard/focus, computed contrast, reduced motion, light/dark print, dense regions, favicon/formats, and labels. | All assertions passed in the final 81-test blocking suite. |
| Existing weak/serial tests | `ui-ux-review.spec.js` now uses `getByLabel` for the real associations; file-level serial mode was removed from `web-regressions.spec.js`. | Implemented. |
| Rendered Svelte component harness | `apps/web/package.json` still has no DOM-capable Svelte component-test command/dependencies/config. Rendered behavior is covered by the focused built-app E2E spec, but this does not satisfy the plan's separately stated component-suite requirement. | Open test-infrastructure gap; C1-060 final acceptance remains unchecked. |

Non-browser validation from this reconciliation:

- `astro check`: 70 files, 0 errors, 0 warnings, 0 hints.
- Focused production tests: 26 passed, 0 failed (`cards-loader`, `print-controller`, `long-name-wrapping`, `analyzer-adapter`, `store-persistence`).
- `node --check`: focused Plan 70 spec plus the two edited regression specs passed.
- `playwright test --list`: 12 tests discovered in `plan70-accessibility-regressions.spec.js`.
- The expanded blocking E2E suite completed four times: 75/81, 79/81, 80/81, then 81/81. Every nonzero batch still ran all 81 tests, returned its real status, and completed repository-owned cleanup before the next batch.
- The final forced Bun 1.2.6 `verify` passed with zero Turbo cache hits; `test:bun` passed 1,639/1,639 and Vitest passed 2,151/2,151 across 67 files.
- Final `e2e:status --assert-clean` passed, port 4173 was available, and no repository-owned Playwright, preview, Chrome/Chromium, profile, or run record remained.
- Concurrent headless Chrome/ffmpeg processes were traced to `/Users/hletrd/flash-shared/Travelback` and deliberately left untouched. No deploy command ran.
- The dedicated DOM-capable Svelte component harness remains the sole explicit test-infrastructure deferral; C1-060 remains unchecked for that reason.

---

## Quality-gate order

Run all applicable gates after implementation. Record every exit code and continue collecting independent results after a failure.

1. Focused unit tests for changed production helpers.
2. Focused component tests for changed Svelte components.
3. `bun run lint`
4. `bun run typecheck`
5. `bun run test`
6. `bun run build`
7. E2E under the ownership protocol:

   ```sh
   CI=1 bun run test:e2e
   ```

8. Re-run any initially failing focused test after its root-cause fix.
9. Repeat the post-E2E process/port cleanup even if Playwright exits nonzero or is interrupted.

No lint/type/test suppression is an acceptable substitute for a fix. Do not run deploy gates.

## Final acceptance criteria

- [x] C1-026 cannot produce zero-card “success” from timeout/cancellation.
- [x] C1-027 displays percentage and fixed reward types accurately.
- [x] C1-028 shows and preserves per-file partial-parse warnings.
- [x] C1-029 blocks invalid previous spending without clamping.
- [x] C1-030 visibly renders nonfatal total-size warnings.
- [x] C1-031 renders tier labels, not internal IDs.
- [x] C1-032 announces and recovers from card fetch failures.
- [x] C1-033 has mutually consistent dashboard empty/success copy.
- [x] C1-034 uses one supported-format contract across UI and docs.
- [x] C1-045/C1-046/C1-054 meet WCAG contrast thresholds in both themes.
- [x] C1-047 has no nested interactive upload controls and complete keyboard access.
- [x] C1-048 preserves native table semantics.
- [x] C1-049 keeps core chart tracks usable on mobile.
- [x] C1-050 processes a drop exactly once.
- [x] C1-051 keeps mobile recommendations readable.
- [x] C1-052/C1-053 expose selection, disclosure, and current-page state.
- [x] C1-055 produces consistent light, high-contrast print output from both routes.
- [x] C1-056/C1-059 preserve and expose dense data on narrow screens.
- [x] C1-057 honors reduced motion for scrolling.
- [x] C1-058 favicon request returns 200.
- [ ] C1-060 adds semantic, dimensional, and computed-style regressions at unit/component/E2E levels.
- [x] All configured non-deploy gates pass.
- [x] Port 4173 is clear and no repository-owned browser/preview process remains.
- [x] External Travelback and interactive Chrome processes are untouched.
- [x] Pre-existing dirty changes and all review-file hashes are preserved.

## Deferrals

No product finding is deferred. One test-infrastructure item remains:

- The dedicated DOM-capable Svelte component harness and separately listed rendered component suites are deferred to the parent cycle's disposition. The focused built-app E2E spec covers those user-visible boundaries, but it is not claimed as a component-test substitute; C1-060 remains unchecked.

All assigned product findings remain in scope. In particular:

- C1-026 and C1-028 are correctness Highs and cannot be deferred.
- C1-045 through C1-049 are accessibility Highs and cannot be deferred.
- C1-056/C1-059 have Medium confidence but concrete responsive acceptance tests are defined; they remain in scope.
- No Medium performance-related UI item in this assigned ID range requires deferral.

## ID coverage

| ID | Original severity / confidence | Plan step | Primary production locations | Disposition |
|---|---|---:|---|---|
| C1-026 | High / High | 1 | `cards.ts:90-184,225-264`; `analyzer.ts:191-218,264-280` | Implemented and verified |
| C1-027 | Medium / High | 2 | `CardDetail.svelte:48-57,217-258`; `formatters.ts:12-27` | Implemented and verified |
| C1-028 | High / High | 3 | `analyzer.ts:320-365,462-471`; `store.svelte.ts:68-81,315-343`; result pages | Implemented and verified |
| C1-029 | Medium / High | 4 | `FileDropzone.svelte:282-325,561-605` | Implemented and verified |
| C1-030 | Medium / High | 4 | `FileDropzone.svelte:180-235,610-632` | Implemented and verified |
| C1-031 | Medium / High | 2 | `CardDetail.svelte:59-79,190-258`; `cards.ts:3-18` | Implemented and verified |
| C1-032 | Medium / High | 5 | `CardGrid.svelte:86-93,160-176`; `CardDetail.svelte:86-121` | Implemented and verified |
| C1-033 | Medium / High | 6 | `dashboard.astro:29-48`; `VisibilityToggle.svelte:55-123` | Implemented and verified |
| C1-034 | Medium / High | 4 | `FileDropzone.svelte:97-106,221-227,498-508`; `README.md:33`; parser entry points | Implemented and verified |
| C1-045 | High / High | 7 | `app.css:5-45`; primary/status foreground consumers | Implemented and verified |
| C1-046 | High / High | 7 | `formatters.ts:115-153`; issuer consumers in card/dashboard/report components | Implemented and verified |
| C1-047 | High / High | 4 | `FileDropzone.svelte:423-511` | Implemented and verified |
| C1-048 | High / High | 8 | `OptimalCardMap.svelte:80-168` | Implemented and verified |
| C1-049 | High / High | 10 | `CategoryBreakdown.svelte:195-265`; `SavingsComparison.svelte:145-186` | Implemented and verified |
| C1-050 | Medium / High | 4 | `FileDropzone.svelte:29-69,423-443` | Implemented and verified |
| C1-051 | Medium / High | 10 | `OptimalCardMap.svelte:55-169` | Implemented and verified |
| C1-052 | Medium / High | 8 | `CardGrid.svelte:98-158`; `OptimalCardMap.svelte:62-77`; `SavingsComparison.svelte:267-314` | Implemented and verified |
| C1-053 | Medium / High | 9 | `Layout.astro:71-156`; `layout.js:40-104` | Implemented and verified |
| C1-054 | Medium / High | 7 | `index.astro:11-28` | Implemented and verified |
| C1-055 | Medium / High | 12 | `results.astro:88-110`; `report.astro:67-95`; `app.css:88-100` | Implemented and verified |
| C1-056 | Medium / Medium | 11 | `ReportContent.svelte:27-135`; `report.astro:55-61` | Implemented and verified |
| C1-057 | Low / High | 9 | `app.css:47-49,102-109`; `CardPage.svelte:29-39` | Implemented and verified |
| C1-058 | Low / High | 13 | `Layout.astro:54`; `public/icon.svg` | Implemented and verified |
| C1-059 | Medium / Medium | 11 | `CardDetail.svelte:217-258`; `ReportContent.svelte:27-135` | Implemented and verified |
| C1-060 | Low / High | 14 | `ui-ux-review.spec.js:479-516,537-574`; screenshot and regression specs | E2E authored; component harness open |

Coverage check: 9 IDs in C1-026–C1-034 plus 16 IDs in C1-045–C1-060 equals 25 implemented product IDs, with one explicit test-infrastructure deferral and no product finding omitted.

## Handoff diff check

Before declaring implementation complete:

1. Run:

   ```sh
   git diff --check
   git status --short
   git diff --name-only
   ```

2. Compare the final path list with the captured dirty baseline and this plan's expected file set. Investigate every unexpected path.
3. Recompare hashes for `.context/reviews/**`; no review file may have changed during implementation.
4. Review the complete final diff of `apps/web/src/lib/store.svelte.ts` and confirm the pre-existing amount/parser/store work remains intact alongside the warning-persistence change.
5. Confirm no generated screenshot, trace, browser profile, temporary fixture, or server PID file was added to the repository.
6. Run the post-E2E process check one final time and record:

   - TCP 4173 listener state;
   - exact repository-owned preview/browser PIDs terminated;
   - any external browser PIDs deliberately preserved.

7. Report gate failures if any remain; do not hide them and do not deploy.
