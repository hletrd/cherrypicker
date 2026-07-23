# Cycle 9 designer review

## Provenance and scope

- Specialist lens: designer — information architecture, interaction/focus, responsive behavior, WCAG 2.2 semantics, UI states, themes, locale resilience, and user-perceived performance.
- Review date: 2026-07-24.
- Reviewed commit: `c5c6eab9b421e547d66716e989e08c747cc36aa1`.
- Full tracked inventory: 2,232 files; manifest SHA-256 `47bfbcc36706291e34da2709db76b134184c2c99fe9c25151cc8ac12de83f0d1`.
- Active inventory excluding historical `.context` plan/review bodies: 1,153 files; manifest SHA-256 `593f6630e814f550d7db85b63685c91a3056e0abf7aedce18e82ede9ba5377e8`.

## Required skill and inventory coverage

The following nine agent-browser skill manuals were read in full before live interaction:

- `agent-browser`
- `agent-browser-config`
- `agent-browser-debug`
- `agent-browser-interact`
- `agent-browser-network`
- `agent-browser-query`
- `agent-browser-state`
- `agent-browser-visual`
- `agent-browser-wait`

Every relevant UI/product/config/test/document family was inventoried. The UI surface contains 1 global CSS file, 14 Svelte components, 1 Astro layout, 5 Astro pages, and 3 public runtime scripts. The review also covered all 53 web tests, 12 E2E specifications/baselines, web/build manifests and configuration, the shared core/parser/rules/viz contracts feeding the UI, root workflow/toolchain files, README/policies, all 683 card rules, and generated catalog artifacts at their publication boundary.

Static and live coverage included:

- Home/upload, dashboard, results, report, card list/detail, global navigation/footer, and persistence degradation.
- Information hierarchy, labels/disclosures, upload progress, validation, success/error/loading/empty states, partial warnings, and reoptimization controls.
- Keyboard order, skip link, focus restoration, expandable controls, named regions/tables, target geometry, and WCAG 2.2 semantics.
- Desktop and narrow-layout source contracts, horizontal overflow protections, reduced motion, light/dark tokens, Korean locale metadata, and the current absence of translated/RTL product support.
- Navigation timing, resource count, layout overflow, long-task entries, and animation behavior as bounded local indicators for LCP/CLS/INP risk.

## Bounded live interaction and process safety

Before starting the preview, and again before starting the browser, the review inventoried:

- Repository E2E ownership records and status.
- Port 4173 listener PIDs.
- Candidate Playwright, Astro preview, agent-browser, Chromium, and Chrome commands.
- PID/PPID/PGID, command, cwd, browser profile argument, and parent process.

The initial state had no owned runs, no relevant browser/preview processes, and port 4173 was available. The attributable preview was:

```text
PID 92306, PGID 92306
node .../cherrypicker/node_modules/.bin/astro preview --host 127.0.0.1 --port 4173
cwd=/Users/hletrd/flash-shared/cherrypicker/apps/web
```

One isolated agent-browser session used `/tmp/cherrypicker-c9-designer-profile`. No Playwright/E2E suite was launched.

Text-extractable live evidence:

- The desktop accessibility tree exposed one Korean `h1`, named navigation/main/footer landmarks, a named upload region, an ordered four-step list, and a labeled file control.
- Keyboard Tab revealed the skip link at approximately `133×36` CSS pixels with a visible outline; Enter focused `main#main-content` and set `#main-content`.
- The 1,280-pixel page had `scrollWidth === clientWidth`; no document-level horizontal overflow was present.
- Invalid `1.5` previous-month spending set `aria-invalid="true"`, referenced error and help text with `aria-describedby`, exposed a role-alert message, and moved focus to the next actionable control. Correcting it to `300000` completed analysis and exposed the explicit “대시보드 보기” continuation.
- The success transition used a polite status message and moved focus to the continuation button.
- The fresh system-dark state produced dark tokens with `rgb(15, 23, 42)` background and `rgb(241, 245, 249)` text. Reduced-motion handling is present globally at `app.css:189-198`.
- Local static navigation reached `DOMContentLoaded` at about 63 ms and load completion at about 64 ms, with no captured long task or document overflow. No production-performance claim is inferred from loopback timing.

After the interaction, `agent-browser close` terminated the isolated browser and the attributable preview received its own terminal interrupt. Final verification reported:

```text
E2E status: repository clean
port 4173: available; no listener
candidate Playwright/preview/agent-browser/Chrome processes: none
ownership records: none
```

The transient browser profile remained confined to `/tmp`; no repository artifact was produced.

## Finding

### C9-D-01 — Decorative inline SVGs remain exposed as unnamed images

- Severity: Low
- Confidence: High
- Classification: Confirmed
- Exact region:
  - `apps/web/src/components/upload/FileDropzone.svelte:494-497`
  - `apps/web/src/components/upload/FileDropzone.svelte:539-545`
  - `apps/web/src/components/upload/FileDropzone.svelte:574-584`
  - `apps/web/src/components/upload/FileDropzone.svelte:588-595`
  - `apps/web/src/components/upload/FileDropzone.svelte:646-650`
  - `apps/web/src/components/upload/FileDropzone.svelte:727-732`
  - `apps/web/src/components/upload/FileDropzone.svelte:744-750`
  - `apps/web/src/components/cards/CardDetail.svelte:265-277`

Failure scenario:

After selecting a statement, the accessibility snapshot exposed the completed first upload step as an unnamed `image` followed by “파일 선택.” The same markup pattern is used for the success check, remove/add icons, detected-bank check, progress spinner, error icon, and external-link glyph. These graphics duplicate adjacent text or control names and convey no independent content, but lack `aria-hidden`.

A screen-reader user can therefore encounter anonymous “image/graphic” nodes inside otherwise well-named steps, status states, and controls. The noise is especially repetitive during the four-state upload flow.

Rationale:

WCAG non-text-content semantics require decorative graphics to be ignored. The shared `Icon` component handles decoration, but these remaining inline SVGs bypass that contract. The issue is confirmed in the browser accessibility tree, not inferred from screenshot appearance.

Suggested fix:

Add `aria-hidden="true"` and `focusable="false"` to every decorative inline SVG listed above. Keep the adjacent text, `aria-label`, role-alert, or role-status as the sole accessible description. If a future graphic conveys unique meaning, give it a deliberate accessible name instead. Add an accessibility-tree regression asserting that upload states and card-detail links contain no unnamed image nodes.

## Final missed-issue sweep

The closing pass covered IA, affordances, keyboard/focus, WCAG 2.2, desktop/narrow responsive contracts, loading/empty/error/form/success states, light/dark mode, reduced motion, Korean language metadata, RTL resilience limits, and LCP/CLS/INP risk. Existing skip-link, focus restoration, validation association, mobile target-size, scroll-region, theme-token, and reduced-motion fixes remain present. No screenshot interpretation was used as evidence, and no second browser run was started.

Findings: 1 total — 1 Low.
