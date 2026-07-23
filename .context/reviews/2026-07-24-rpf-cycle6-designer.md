# Cycle 6 designer review

## Provenance and result

- Review type: designer/UI/UX review only
- Date: 2026-07-24 (Asia/Seoul)
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Reviewed commit: `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
- Baseline consulted: the Cycle 5 designer review and the current implementations of its fixes. Resolved Cycle 5 items are not repeated here.
- Result: **1 confirmed open finding** — 0 Critical, 0 High, 1 Medium, 0 Low.

## UI inventory reviewed

| Area | Current-code inventory |
| --- | --- |
| Global shell, CSS, tokens, and routes | `apps/web/src/app.css`; `apps/web/src/layouts/Layout.astro`; `apps/web/src/pages/index.astro`, `dashboard.astro`, `cards/index.astro`, `results.astro`, and `report.astro` |
| Upload and analysis UI | `components/upload/FileDropzone.svelte`; `components/dashboard/{SpendingSummary,CategoryBreakdown,SavingsComparison,TransactionReview,OptimalCardMap}.svelte`; `components/ui/{AnalysisWarnings,VisibilityToggle,Icon,IssuerBadge}.svelte` |
| Card and report UI | `components/cards/{CardPage,CardGrid,CardDetail}.svelte`; `components/report/ReportContent.svelte` |
| Client state and transitions | `lib/{store.svelte,store,persistence,analysis-context,analysis-disclosures,analysis-replacement-runtime,analysis-reset-runtime,pending-navigation,operation-epoch,file-parse-queue,upload-admission,upload-validation,tx-validation,card-grid-state,card-detail-display}.ts` |
| Data loading and display mapping | `lib/{api,cards,card-catalog-reader,catalog-publication-identity,catalog-reward-display,category-labels,category-labels-fallback,formatters,external-url,supported-formats}.ts`; analyzer/optimizer and parser modules under `apps/web/src/lib` |
| Public runtime assets | `apps/web/public/scripts/{layout,frame-guard,print}.js`; `icon.svg`; `data/{categories,cards,cards-summary,cards-optimizer}.json`; all 24 issuer shards under `data/card-details/` |
| Canonical data relevant to the finding | `packages/rules/data/issuers.yaml`; `packages/parser/src/detect.ts`; published `apps/web/public/data/card-details/bnk.json`; issuer inventory in `README.md` |
| Browser regression coverage inspected | `e2e/{catalog-request-boundaries,core-regressions,parser-worker-responsiveness,plan70-accessibility-regressions,report-regressions,security-regressions,ui-ux-review,ui-ux-screenshots,visual-regressions,web-regressions}.spec.js`, fixtures, visual CSS, and checked-in reference images |
| Web unit/contract coverage inspected | All 38 files in `apps/web/__tests__`, including accessibility/UI contracts, responsive dashboard state, long-name wrapping, upload/error contracts, persistence, parser workers, card loading/detail/grid state, print, and transaction review |
| Product documentation inspected | `README.md`, relevant package scripts/configuration, and the Cycle 5 designer review. There is no repository `docs/` directory. |

## Static and live coverage

The static pass traced information architecture and data flow from upload admission through parsing, validation, analysis persistence, dashboard/results/report presentation, card catalog loading, responsive branches, and print behavior. It also reviewed keyboard handlers, focus restoration, live regions, labels/descriptions, disclosure state, table semantics, error/empty/loading branches, light/dark tokens, reduced-motion CSS, Korean copy, and the current E2E contracts.

The bounded live pass used a production preview at `http://127.0.0.1:4173/cherrypicker/` with a named, isolated browser session.

- At 1440×1000, the home page, upload flow, and analyzed dashboard were inspected in system-dark and explicit-light modes; the theme control was also operated by keyboard back toward dark mode.
- Keyboard evidence included the skip link receiving a visible focus outline and moving focus to `main#main-content`, Enter activation of the upload/analysis flow, and validation focus remaining on the invalid previous-spending input.
- Upload error evidence used an unsupported `README.md`: the UI exposed an `alert` with the supported-format message and a reachable retry button.
- Validation evidence used `-1` for previous spending: the input became `aria-invalid="true"`, was described by its help and error text, and announced “전월 카드 이용액은 0원 이상이어야 해요”.
- Success evidence used `e2e/fixtures/regression-upload.csv` and a 300,000원 previous-spending value. The completion status was announced, the dashboard navigation control received focus, and `/dashboard` exposed headings, summary status, warning region, expandable transaction review, native labeled category comboboxes, a semantically labeled recommendation table, and the results link.
- The upload selector’s “더보기 (16)” disclosure exposed all 24 explicit bank choices without desktop root overflow. Its live `bnk` label is part of D6-01.
- Runtime requests observed for the reviewed flow were same-origin and successful, including `categories.json` and `cards-optimizer.json`; no console error or page error was reported during the captured home/upload/dashboard path.
- State inspection found the analysis only in `sessionStorage` under `cherrypicker:analysis` (161,444 serialized bytes in this fixture run) and the explicit theme preference in `localStorage`.
- Local-preview timing evidence after reload was approximately 30 ms navigation/load, 44 ms first contentful paint, and CLS 0. No LCP entry was emitted in this very fast cached sample, and this review did not claim field LCP or INP from it.

Responsive CSS and the current desktop/tablet/mobile E2E contracts were inspected statically. A separate live tablet/mobile viewport, synthetic RTL layout, reduced-motion runtime, cards-catalog forced-network-failure path, report print preview, and field-quality LCP/INP run were **not completed in this bounded pass** and remain unverified here. The product currently declares Korean (`lang="ko"`) and does not expose a locale or RTL mode, so no unsupported RTL behavior is promoted to a finding. Loading, empty, retry, and network-error implementations were inspected in source; only upload error/validation were exercised live.

## Confirmed finding

### D6-01 — The shared `bnk` identifier is presented as Gyeongnam Bank even though the shipped card catalog is Busan Bank

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed / open**
- Affected dimensions: information scent, bank-selection affordance, recommendation credibility, data-to-UI consistency

#### Source evidence

- `apps/web/src/components/upload/FileDropzone.svelte:148-173` defines all upload-bank labels; line 162 maps `bnk` to `BNK경남`.
- `apps/web/src/lib/formatters.ts:87-110` is the shared issuer formatter; line 102 maps the same ID to `BNK경남은행`.
- `apps/web/src/components/ui/IssuerBadge.svelte:13-23` falls back to that formatter, so a canonical catalog label is replaced by the incorrect global label.
- `apps/web/src/components/cards/CardGrid.svelte:360-394` also uses that formatter for the selected issuer and every issuer-filter button.
- In contrast, the source of truth at `packages/rules/data/issuers.yaml:72-75` defines `bnk` as `BNK부산은행`, and `README.md:77` inventories the same ID as `BNK부산은행` with 19 cards. The published issuer shard, `apps/web/public/data/card-details/bnk.json:1`, likewise identifies the issuer as `BNK부산은행` and points to `busanbank.co.kr`.
- The ambiguity originated in parsing: `packages/parser/src/detect.ts:98-101` deliberately maps both 부산은행 and 경남은행 statement signatures to the single `bnk` parser ID. That parser convenience is being reused as if it were one canonical card issuer identity.

#### Runtime textual evidence

- Route/viewport/theme: `/cherrypicker/`, 1440×1000, explicit light theme.
- Stable selector: `[data-testid="bank-pill-bnk"]`.
- Observed text after activating “더보기 (16)”: **“BNK경남”**. There was no separately named 부산은행 choice even though every shipped `bnk` card is in the 부산은행 catalog.
- Route/viewport/theme: `/cherrypicker/dashboard`, 1440×1000, explicit light theme, after analyzing `e2e/fixtures/regression-upload.csv`.
- Semantic runtime path: `main table` → row header “공과금” → recommendation cell containing the `IssuerBadge` (`[data-testid="issuer-badge"]`).
- Accessibility snapshot text: **“BNK경남은행 부자되세요 아파트카드”**. The recommended `bnk-apartment` card comes from the published Busan Bank shard, so the rendered bank name is factually different from its data.

#### Failure scenario

A Busan Bank customer manually selecting a statement parser sees only “BNK경남” and can reasonably conclude that Busan Bank is unsupported. If auto-detection succeeds, the same shared ID later renders Busan Bank catalog cards as Gyeongnam Bank in filters, badges, and dashboard recommendations. The benefit amount may remain numerically unchanged, but the UI attributes a financial product to the wrong bank, undermining confidence precisely where the user is deciding whether a recommendation applies to them.

#### Recommended fix

Separate parser-adapter identity from card-issuer presentation identity.

1. Keep the catalog issuer `bnk` canonical label sourced from the published issuer metadata (`BNK부산은행`) and pass that label through summary/optimizer records instead of overriding it with `formatIssuerNameKo`.
2. For upload parsing, either split 부산 and 경남 into distinct adapter IDs or name the intentionally shared parser choice unambiguously, such as `BNK부산·경남`, while preserving the detected institution separately.
3. Remove the duplicated hard-coded issuer-name maps in `FileDropzone.svelte` and `formatters.ts` in favor of one typed presentation source with explicit parser-label versus catalog-label fields.
4. Add a contract/E2E assertion that `[data-testid="bank-pill-bnk"]` communicates the parser’s actual scope, while `/cards?issuer=bnk`, issuer badges, and a dashboard `bnk` recommendation all render the canonical Busan Bank catalog identity.

## Final missed-issue sweep

The final pass rechecked the current-code paths for direct issuer labels, hard-coded visual tokens, missing accessible names, disclosure/focus behavior, validation/error announcements, loading/empty states, responsive overflow branches, long content, session persistence, request boundaries, and console errors. D6-01 was the only issue that met the evidence threshold. Current implementations corresponding to the Cycle 5 review were not re-reported when the old failure was no longer present.

The following are coverage limits, not inferred product findings: no independent live mobile/tablet rendering, no forced card-data outage, no synthetic RTL/reduced-motion runtime, no print-dialog capture, and no field performance trace. Those paths should be retained in the next browser pass rather than being treated as passed by this report.

## Process-safety and cleanup proof

- Preflight: `bun scripts/run-e2e.ts status --assert-clean` reported `repository clean (no owned runs; default port 4173 is available)`. `lsof -nP -iTCP:4173 -sTCP:LISTEN` returned no listener.
- Owned preview: exact listener PID `86075`, command `astro preview --host 127.0.0.1 --port 4173`, cwd `apps/web`, marker `CHERRYPICKER_REVIEW_MARKER=c6-designer-449f10a-bBE5u8`.
- Owned browser: session `c6-designer-449f10a-bBE5u8`; profile `/tmp/cherrypicker-c6-designer-449f10a.bBE5u8/profile`; observed daemon/root PIDs `89419`/`89420`. Screens, trace, state, and profile were confined to that unique `/tmp` directory.
- Teardown: `agent-browser close` returned `Browser closed`; the exact preview exec session was interrupted and reaped. No broad process signal was used. An unrelated Travelback Playwright tree seen during preflight was left untouched.
- Final postflight retry: `bun scripts/run-e2e.ts status --assert-clean` again reported `repository clean (no owned runs; default port 4173 is available)`.
- `ps -p 86075,89419,89420 -o pid=,ppid=,pgid=,command=` returned no rows. A marker/profile/preview-pattern `ps` search returned only the short-lived inspection shell and its own `rg`, with no attributable preview or browser process.
- Final `lsof -nP -iTCP:4173 -sTCP:LISTEN` returned no rows.

