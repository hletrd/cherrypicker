# Aggregate Review -- Cycle 48

## New Findings: 3 actionable

### Actionable (implement this cycle)

**F1. Web-side SUMMARY_ROW_PATTERN missing `합산` [MEDIUM]**
- `apps/web/src/lib/parser/column-matcher.ts`
- Server-side has 합산 (cycle 47), web-side does not
- Fix: add `(?<![가-힣])합\s*산(?![가-힣])` to web-side pattern

**F2. Web-side XLSX forward-fill missing summary row guard [MEDIUM]**
- `apps/web/src/lib/parser/xlsx.ts`
- Server-side guards forward-fill with SUMMARY_ROW_PATTERN check (cycle 47), web-side does not
- Fix: add guard before updating lastDate and lastMerchant

**F3. Web-side detectFormatFromFile missing `.tsv` [LOW]**
- `apps/web/src/lib/parser/detect.ts`
- Server-side handles `.tsv` explicitly, web-side falls through to default
- Fix: add explicit `.tsv` check

### Deferred (unchanged)

| Item | Reason |
|------|--------|
| D-01 | Server/web shared module -- architectural refactor |
| D-02 | PDF multi-line headers -- edge case |
| D-03 | Web CSV hand-rolled adapters -> factory pattern |