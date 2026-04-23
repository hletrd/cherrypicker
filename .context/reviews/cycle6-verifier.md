# Cycle 6 — verifier (evidence-based correctness)

## Commands exercised
- `bun run test:e2e --reporter=json` → turbo build success; playwright: unknown in JSON stream; re-run below.
- `bunx playwright test e2e/core-regressions.spec.js --reporter=line` → 1 failed (optimizer regression), 1 passed.
- `bunx playwright test e2e/ui-ux-review.spec.js e2e/web-regressions.spec.js --reporter=line` → 59 failed (58 connection-refused because spec hardcodes `:4174` while server is on `:4173`; 1 timeout in web-regressions dashboard flow).

## Evidence of findings

### C6UI-01 (wrong port) — verified
```
e2e/ui-ux-review.spec.js:7:     const BASE = 'http://127.0.0.1:4174/cherrypicker/';
e2e/ui-ux-screenshots.spec.js:7: const BASE = 'http://127.0.0.1:4174/cherrypicker/';
e2e/web-regressions.spec.js:5:  const homeUrl = 'http://127.0.0.1:4173/cherrypicker/';
playwright.config.ts:3:         const port = 4173;
```
Every test in `ui-ux-review.spec.js` errored with
`net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4174/cherrypicker/`.

### C6UI-40 (optimizer fixture vs rule mismatch) — verified
```
Expected length: 2
Received length: 1
Received array:  [{"...", "assignedCardId": "fixture-subcategory-card", "rate": 0.025, "reward": 1000, "spending": 40000, ...}]
```
Code evidence: `packages/core/src/calculator/reward.ts:63-80` explicitly
skips broad-category rules when the transaction has a subcategory.

### C6UI-06 (label drift) — verified
```
apps/web/src/components/dashboard/SpendingSummary.svelte:74:   <span>최근 월 지출</span>
e2e/ui-ux-review.spec.js:226:  await expect(page.getByText('총 지출')).toBeVisible();
```

### C6UI-08 (class stacking) — verified
```
apps/web/src/components/dashboard/TransactionReview.svelte:290-292:
  class="... {tx.confidence < 0.5 ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}
             {tx.category === 'uncategorized' ? 'border-red-300 bg-red-50 text-red-700' : ''}"
```
Both fragments can apply simultaneously; the cascade picks the later for
each conflicting property but the intent is ambiguous.

### C6UI-38 (no testids) — verified
```
$ grep -rn 'data-testid' apps/web/src
(no matches)
```

### C6UI-16 (no beforeunload) — verified
Search `apps/web/src` for `beforeunload` → 0 matches.

## Gate summary
- `bun run verify` was NOT run end-to-end this cycle (deferred until after
  fixes land). Expected: lint+typecheck pass (no TS file changes yet);
  unit tests depend on packages only (not UI).
- `bun run build` not rerun; prior builds are green.
- `bun run test:e2e` fails on C6UI-40 + C6UI-01.

## Verification plan after fixes
1. Fix C6UI-01 (port). Re-run `bunx playwright test e2e/ui-ux-review.spec.js` → expect the failures that are NOT merely port-related (C6UI-06 copy) to remain until fixed.
2. Fix C6UI-40 (fixture). Re-run `e2e/core-regressions.spec.js` → 2/2 pass.
3. Fix C6UI-06 + C6UI-16 + C6UI-34 + C6UI-08. Re-run full `bun run test:e2e`.
