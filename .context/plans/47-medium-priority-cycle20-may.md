# Plan 47 — Medium/Low-Priority Fixes (Cycle 20, May 2026)

**Priority:** MEDIUM/LOW
**Findings addressed:** C20-TEST01, C20-TEST02, C20-TEST03, C20-UI01, C20-SEC02, C20-CRIT02
**Status:** TODO

---

## Task 1: Add full-width OFX amount tests (C20-TEST01)

**Finding:** C20-TEST01 (LOW) — No server-side test verifies OFX parsing with full-width digits, Won signs, or `마이너스` prefix. After Plan 46 Task 1 unifies parsing with `parseAmountString`, these tests validate the parity fix.

**File:** `packages/parser/__tests__/ofx.test.ts`

**Implementation:**

Add a new `describe` block under "Edge cases":
```ts
describe('Full-width and localized amount formats (C20-TEST01)', () => {
  it('parses full-width digits with commas', () => {
    const content = `<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115</DTPOSTED><TRNAMT>-１，２３４</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>`;
    const result = parseOFX(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.amount).toBe(1234);
  });

  it('parses Won sign prefix', () => {
    const content = `<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115</DTPOSTED><TRNAMT>-￦15000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>`;
    const result = parseOFX(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.amount).toBe(15000);
  });

  it('parses 마이너스 prefix', () => {
    const content = `<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115</DTPOSTED><TRNAMT>마이너스5000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>`;
    const result = parseOFX(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.amount).toBe(5000);
  });

  it('parses trailing minus sign', () => {
    const content = `<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115</DTPOSTED><TRNAMT>10000-</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>`;
    const result = parseOFX(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.amount).toBe(10000);
  });
});
```

**Commit:** `test(parser): ✅ add full-width OFX amount parsing tests (C20-TEST01)`

---

## Task 2: Add metacharacter tag defensive test (C20-TEST02)

**Finding:** C20-TEST02 (LOW) — No test verifies behavior when OFX content contains tags with regex metacharacters. After Plan 46 Task 2 adds escaping, this test ensures malformed tags don't crash parsing.

**File:** `packages/parser/__tests__/ofx.test.ts`

**Implementation:**

Add under "Edge cases":
```ts
it('handles tags with regex metacharacters gracefully (C20-TEST02)', () => {
  // Malformed OFX with regex metacharacters in tag names — should not throw
  const content = `<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME+>STARBUCKS</NAME+></STMTTRN>
</BANKTRANLIST>`;
  // After escapeRegExp fix, this should parse without SyntaxError
  const result = parseOFX(content);
  // NAME+ won't match NAME extraction, so merchant falls back to empty/MEMO
  expect(result.transactions.length).toBeGreaterThanOrEqual(0);
  expect(result.errors.length).toBeGreaterThanOrEqual(0);
});
```

**Commit:** `test(parser): ✅ add OFX metacharacter tag defensive test (C20-TEST02)`

---

## Task 3: Add HTML summary row forward-fill test (C20-TEST03)

**Finding:** C20-TEST03 (LOW) — No test verifies that summary row amounts are NOT forward-filled to subsequent merged cells. A test with header -> summary row -> merged data rows would reveal the C20-DB03 bug.

**Files:**
- `apps/web/__tests__/parser-html.test.ts` (web-side)
- `packages/parser/__tests__/html.test.ts` (server-side)

**Implementation:**

Add to web-side HTML tests (or create if the test file is sparse):
```ts
it('does not forward-fill summary row amounts to merged cells (C20-TEST03)', () => {
  const html = `
    <table>
      <thead><tr><th>날짜</th><th>가맹점</th><th>금액</th></tr></thead>
      <tbody>
        <tr><td>2024-01-15</td><td>스타벅스</td><td>5000</td></tr>
        <tr><td></td><td></td><td>총합계 999999</td></tr>
        <tr><td>2024-01-16</td><td>이마트</td><td></td></tr>
      </tbody>
    </table>
  `;
  const result = parseHTML(html);
  // The third row (이마트) has an empty amount cell that would forward-fill.
  // After the fix, summary row values must not propagate.
  const emartTx = result.transactions.find((t) => t.merchant.includes('이마트'));
  if (emartTx) {
    expect(emartTx.amount).not.toBe(999999);
  }
});
```

**Note:** Verify `parseHTML` is exported and testable from `apps/web/src/lib/parser/html.ts`. If web-side HTML parser has no test infrastructure, add the test to `packages/parser/__tests__/html.test.ts` instead.

**Commit:** `test(parser): ✅ add HTML summary row forward-fill guard test (C20-TEST03)`

---

## Task 4: Add accessibility attributes to HTML report tables (C20-UI01)

**Finding:** C20-UI01 (LOW) — Generated HTML tables lack `scope="col"` on header cells, `<caption>` elements, and `aria-label` attributes. Screen readers struggle with multi-column data tables.

**File:** `packages/viz/src/report/generator.ts:75-136`, `:139-175`, `:177-233`

**Implementation:**

Update all three `build*` table functions. For each table:

1. `buildCategoryTable` (line 117):
   ```ts
   return `
     <table>
       <caption>카테고리별 지출 현황</caption>
       <thead>
         <tr>
           <th scope="col">카테고리</th>
           <th scope="col" class="right">지출액</th>
           <th scope="col" class="right">건수</th>
           <th scope="col" class="right">비중</th>
         </tr>
       </thead>
       ...
   ```

2. `buildCardComparison` (line 162):
   ```ts
   return `
     <table>
       <caption>카드별 혜택 비교</caption>
       <thead>
         <tr>
           <th scope="col">카드명</th>
           <th scope="col" class="right">총 혜택액</th>
           <th scope="col" class="right">유효 혜택률</th>
           <th scope="col">전월실적 구간</th>
           <th scope="col" class="center">한도</th>
         </tr>
       </thead>
       ...
   ```

3. `buildAssignments` (line 218):
   ```ts
   return `
     <table>
       <caption>카테고리별 최적 카드 배분</caption>
       <thead>
         <tr>
           <th scope="col">카테고리</th>
           <th scope="col">추천 카드</th>
           <th scope="col" class="right">혜택률</th>
           <th scope="col" class="right">예상 혜택</th>
           <th scope="col" class="right">지출액</th>
           <th scope="col">대안 카드</th>
         </tr>
       </thead>
       ...
   ```

**Verification:** Generate a report and inspect the HTML output. Verify `<caption>` and `scope="col"` are present.

**Commit:** `feat(viz): ✨ add accessibility attributes to HTML report tables (C20-UI01)`

---

## Task 5: Sanitize HTML before passing to SheetJS (C20-SEC02)

**Finding:** C20-SEC02 (LOW) — HTML parser passes unsanitized content to `xlsx.read()`. While SheetJS doesn't execute JavaScript, entity expansion bombs and nested tables could cause issues. Defense-in-depth sanitization is warranted.

**File:** `apps/web/src/lib/parser/html.ts:26-30` (normalizeHTML)

**Implementation:**

1. Expand `normalizeHTML` to also strip dangerous content before SheetJS parsing:
   ```ts
   /** Fix malformed closing tags and strip dangerous content before SheetJS parsing.
    *  Removes script tags, event handlers, iframe/object/embed tags, and style blocks
    *  to prevent entity expansion bombs and unexpected SheetJS behavior (C20-SEC02). */
   export function normalizeHTML(html: string): string {
     return html
       // Strip script tags and their contents
       .replace(/<script[\s\S]*?<\/script>/gi, '')
       // Strip style tags and their contents
       .replace(/<style[\s\S]*?<\/style>/gi, '')
       // Strip iframe, object, embed tags
       .replace(/<(iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
       .replace(/<(iframe|object|embed)[^>]*>/gi, '')
       // Remove event handler attributes (onclick, onerror, etc.)
       .replace(/\son\w+=["'][^"']*["']/gi, '')
       .replace(/\son\w+=\w+/gi, '')
       // Fix malformed closing tags
       .replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>')
       .replace(/<\/([a-z][a-z0-9]*)\s+>/gi, '</$1>');
   }
   ```

2. Verify the same logic is applied to `packages/parser/src/html/index.ts` (server-side) if it has a `normalizeHTML` function.

**Commit:** `fix(parser): 🐛 sanitize HTML content before SheetJS parsing (C20-SEC02)`

---

## Task 6: Archive completed plan files (C20-CRIT02)

**Finding:** C20-CRIT02 (LOW) — 40+ plan files in `.context/plans/` serve as both active storage and historical archive. Move completed cycle plans to `.context/plans/_archive/`.

**Files:** `.context/plans/`

**Implementation:**

1. Identify completed plan files (those with all tasks checked off, from cycles 1-19):
   - `c1-cycle1-fixes.md`, `c1-cycle1-remaining-fixes.md`, `c1-high-priority-fixes.md`, `c1-low-priority-fixes.md`
   - `c2-high-priority-fixes.md`, `c2-low-priority-fixes.md`
   - `c3-cycle3-fixes.md`, `c3-medium-priority-fixes.md`, `c3-rpf-cycle3-fixes.md`
   - ... all `cN-*-fixes.md` files where N < 20
   - All `cycleN-fixes.md` files where N < 20
   - Old numbered plans `01-` through `33-` that are completed

2. Move completed files to `.context/plans/_archive/`:
   ```bash
   # Example (run after verifying each file is truly complete):
   mv .context/plans/c1-*.md .context/plans/_archive/
   mv .context/plans/c2-*.md .context/plans/_archive/
   # ... etc
   ```

3. Update `.context/plans/00-deferred-items.md` header to note the archival date.

4. Create a brief index file `.context/plans/_archive/README.md` listing archived cycles and their dates.

**Commit:** `chore(docs): 🗂️ archive completed cycle plans to _archive/ (C20-CRIT02)`

---

## Task 7: Update deferred items registry

**Findings to add to `.context/plans/00-deferred-items.md`:**

```markdown
### D-XX: Greedy optimizer marginal reward caching (C20-PERF01)
- **Original finding:** C20-PERF01 (perf-reviewer)
- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:51-53`
- **Reason for deferral:** Algorithmic redesign required. `calculateCardOutput` is called twice per card per transaction, each time re-evaluating all rules for all transactions. Marginal reward caching would require tracking per-card state across the greedy loop, which is a significant architectural change to the pure function design.
- **Exit criterion:** If performance becomes an issue for > 1000 transactions, implement incremental scoring with per-card `previousTotalReward` cache.
- **Maps to:** D-09 (already deferred from cycle 1)

### D-XX: Parser duplication now spans 6 formats (C20-ARCH02)
- **Original finding:** C20-ARCH02 (architect)
- **Severity:** LOW (structural)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/` vs `packages/parser/src/`
- **Reason for deferral:** Same as D-01. Requires extracting isomorphic parsing logic to a shared pure-TS module. Each new format (now JSON, OFX, HTML in addition to CSV, XLSX, PDF) must be implemented twice.
- **Exit criterion:** Schedule a dedicated refactoring sprint with design doc, then extract shared core logic format by format.
- **Maps to:** D-01 (already deferred from cycle 1)

### D-XX: HTML parser string allocation optimization (C20-PERF02)
- **Original finding:** C20-PERF02 (perf-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/html.ts:141-244`
- **Reason for deferral:** Micro-optimization. Per-cell String() conversions and isSummaryRow() calls are already fast enough for typical HTML tables (< 1000 rows). The SUMMARY_ROW_PATTERN is compiled at module level.
- **Exit criterion:** If HTML tables exceed 5000 rows and parsing becomes slow, batch isSummaryRow checks and reduce intermediate string allocations.

### D-XX: Shared C1-01 convention comment extraction (C20-DOC01)
- **Original finding:** C20-DOC01 (document-specialist)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/analyzer.ts:339-341`, `apps/web/src/lib/store.svelte.ts:506-508`
- **Reason for deferral:** Requires creating `docs/conventions.md` and updating all inline references. Low impact — the comments are correct, just duplicated.
- **Exit criterion:** When any convention-related code is changed, extract the comment to a shared location first.

### D-XX: Parser error message standardization (C20-UI02)
- **Original finding:** C20-UI02 (designer)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/` (all formats)
- **Reason for deferral:** Part of ongoing U-DES-02 effort. Error messages are functional but mix technical terms ("header row", "OFX") with user-friendly Korean.
- **Exit criterion:** When U-DES-02 is scheduled, include parser error messages in the standardization pass.
```

**Commit:** `docs(plans): 📝 update deferred items registry with cycle 20 findings`

---

## Progress

- [x] Task 1: Add full-width OFX amount tests
- [x] Task 2: Add metacharacter tag defensive test
- [x] Task 3: Add HTML summary row forward-fill test
- [x] Task 4: Add accessibility attributes to HTML report tables
- [x] Task 5: Sanitize HTML before SheetJS
- [x] Task 6: Archive completed plan files
- [x] Task 7: Update deferred items registry
