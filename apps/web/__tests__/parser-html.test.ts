/**
 * Web-side HTML table parser tests.
 * Parity with server-side packages/parser/__tests__/html.test.ts (T13-01).
 */
import { describe, it, expect } from 'bun:test';
import { parseHTML, normalizeHTML } from '../src/lib/parser/html.js';

describe('HTML Table Parser (web)', () => {
  describe('Basic HTML table parsing', () => {
    it('parses a simple HTML table with headers and data', () => {
      const content = `<html>
<body>
<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>스타벅스 강남점</td><td>5,500</td></tr>
<tr><td>2024.01.20</td><td>이마트</td><td>45,000</td></tr>
</table>
</body>
</html>`;

      const result = parseHTML(content);
      expect(result.format).toBe('html');
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
      expect(result.transactions[0]!.merchant).toBe('스타벅스 강남점');
      expect(result.transactions[0]!.amount).toBe(5500);
      expect(result.transactions[1]!.date).toBe('2024-01-20');
      expect(result.transactions[1]!.merchant).toBe('이마트');
      expect(result.transactions[1]!.amount).toBe(45000);
    });

    it('handles HTML with malformed closing tags', () => {
      const content = `<table>
<tr><th>거래일</th><th>가맹점</th><th>거래금액</th></tr>
<tr><td>2024.01.15</td><td>CU 편의점</td><td>3,000</td   ></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('CU 편의점');
    });

    it('picks the table with most transactions from multiple tables', () => {
      const content = `<html>
<body>
<table>
<tr><td>일반 텍스트</td></tr>
</table>
<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>카페</td><td>5,000</td></tr>
<tr><td>2024.01.16</td><td>식당</td><td>12,000</td></tr>
</table>
</body>
</html>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(2);
    });

    it('skips summary/total rows', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>쇼핑</td><td>30,000</td></tr>
<tr><td></td><td>합계</td><td>30,000</td></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('쇼핑');
    });
  });

  describe('normalizeHTML', () => {
    it('fixes malformed closing tags', () => {
      // normalizeHTML only fixes CLOSING tags, not opening tags
      expect(normalizeHTML('content</td   >')).toBe('content</td>');
      expect(normalizeHTML('</th  ></tr  ></table  >')).toBe('</th></tr></table>');
    });

    it('leaves well-formed tags unchanged', () => {
      expect(normalizeHTML('<td>content</td>')).toBe('<td>content</td>');
    });

    it('strips script tags and their contents (C22-TEST01)', () => {
      expect(normalizeHTML('<td><script>alert(1)</script>value</td>')).toBe('<td>value</td>');
    });

    it('strips style tags and their contents (C22-TEST01)', () => {
      expect(normalizeHTML('<style>body{color:red}</style><td>value</td>')).toBe('<td>value</td>');
    });

    it('strips iframe tags (C22-TEST01)', () => {
      expect(normalizeHTML('<iframe src="evil"></iframe><td>value</td>')).toBe('<td>value</td>');
    });

    it('strips object and embed tags (C22-TEST01)', () => {
      expect(normalizeHTML('<object data="evil"></object><td>value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<embed src="evil"><td>value</td>')).toBe('<td>value</td>');
    });

    it('removes quoted event handler attributes (C22-TEST01)', () => {
      expect(normalizeHTML('<td onclick="alert(1)">value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onerror=\'console.log(1)\'>value</td>')).toBe('<td>value</td>');
    });

    it('removes unquoted event handler attributes with non-word values (C22-TEST01)', () => {
      expect(normalizeHTML('<td onclick=alert(1)>value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onerror=foo(bar)>value</td>')).toBe('<td>value</td>');
    });

    it('removes event handler attributes without values (C22-TEST01)', () => {
      expect(normalizeHTML('<td onclick=>value</td>')).toBe('<td>value</td>');
    });

    it('removes quoted event handlers with spaces in values (C23-TEST01)', () => {
      expect(normalizeHTML('<td onclick="alert(1); console.log(2)">value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onerror="fetch(\'evil\'); doSomething()">value</td>')).toBe('<td>value</td>');
    });

    it('removes quoted event handlers with newlines in values (C23-TEST01)', () => {
      expect(normalizeHTML('<td onclick="alert(1);\nconsole.log(2)">value</td>')).toBe('<td>value</td>');
    });

    it('removes event handlers with spaces around equals sign (C24-TEST01)', () => {
      expect(normalizeHTML('<td onclick ="alert(1)">value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onclick= "alert(1)">value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onclick = "alert(1)">value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onerror = \'console.log(1)\'>value</td>')).toBe('<td>value</td>');
    });

    it('removes unquoted event handlers with spaces around equals sign (C25-TEST02)', () => {
      expect(normalizeHTML('<td onclick =alert(1)>value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onclick= alert(1)>value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onclick = alert(1)>value</td>')).toBe('<td>value</td>');
      expect(normalizeHTML('<td onerror =foo(bar)>value</td>')).toBe('<td>value</td>');
    });

    it('removes event handlers without breaking adjacent attributes (C23-TEST01)', () => {
      expect(normalizeHTML('<td onclick="alert(1)" class="foo">value</td>')).toBe('<td class="foo">value</td>');
      expect(normalizeHTML('<td class="foo" onclick="alert(1)">value</td>')).toBe('<td class="foo">value</td>');
    });

    it('strips javascript: URLs from href and src attributes (C28-TEST05)', () => {
      expect(normalizeHTML('<a href="javascript:alert(1)">link</a>')).toBe('<a>link</a>');
      expect(normalizeHTML('<a href="javascript:void(0)">link</a>')).toBe('<a>link</a>');
      expect(normalizeHTML('<img src="javascript:alert(1)">')).toBe('<img>');
      expect(normalizeHTML('<a href = "javascript:alert(1)">link</a>')).toBe('<a>link</a>');
      expect(normalizeHTML('<a HREF="javascript:alert(1)">link</a>')).toBe('<a>link</a>');
      expect(normalizeHTML('<a href="javascript:alert(1)" class="foo">link</a>')).toBe('<a class="foo">link</a>');
      expect(normalizeHTML('<a href="/safe/path">link</a>')).toBe('<a href="/safe/path">link</a>');
    });
  });

  describe('Edge cases', () => {
    it('returns error for content with no tables', () => {
      const result = parseHTML('<html><body><p>테이블이 없는 페이지</p></body></html>');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.some((e) => e.message.includes('테이블을'))).toBe(true);
    });

    it('returns error when no header row found', () => {
      const content = `<table>
<tr><td>1</td><td>2</td><td>3</td></tr>
<tr><td>4</td><td>5</td><td>6</td></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.some((e) => e.message.includes('헤더'))).toBe(true);
    });

    it('detects bank from HTML content', () => {
      const content = `<html><body>
<h1>KB국민카드 이용내역</h1>
<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>카페</td><td>5,000</td></tr>
</table>
</body></html>`;

      const result = parseHTML(content);
      expect(result.bank).toBe('kb');
    });

    it('forward-fills merged cells in HTML tables (C99-02)', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th><th>할부</th><th>비고</th></tr>
<tr><td>2024.01.15</td><td>스타벅스</td><td>5,500</td><td></td><td></td></tr>
<tr><td></td><td></td><td>4,500</td><td></td><td></td></tr>
<tr><td>2024.01.20</td><td>이마트</td><td>45,000</td><td>3</td><td>온라인</td></tr>
<tr><td></td><td></td><td>15,000</td><td></td><td></td></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(4);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
      expect(result.transactions[0]!.merchant).toBe('스타벅스');
      expect(result.transactions[0]!.amount).toBe(5500);
      // Second row should forward-fill date and merchant from first row
      expect(result.transactions[1]!.date).toBe('2024-01-15');
      expect(result.transactions[1]!.merchant).toBe('스타벅스');
      expect(result.transactions[1]!.amount).toBe(4500);
      // Third row has explicit values
      expect(result.transactions[2]!.date).toBe('2024-01-20');
      expect(result.transactions[2]!.merchant).toBe('이마트');
      expect(result.transactions[2]!.installments).toBe(3);
      expect(result.transactions[2]!.memo).toBe('온라인');
      // Fourth row should forward-fill date, merchant, installments, memo
      expect(result.transactions[3]!.date).toBe('2024-01-20');
      expect(result.transactions[3]!.merchant).toBe('이마트');
      expect(result.transactions[3]!.amount).toBe(15000);
      expect(result.transactions[3]!.installments).toBe(3);
      expect(result.transactions[3]!.memo).toBe('온라인');
    });

    it('skips empty rows', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>카페</td><td>5,000</td></tr>
<tr><td></td><td></td><td></td></tr>
<tr><td>2024.01.16</td><td>식당</td><td>12,000</td></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(2);
    });

    it('does not forward-fill summary row amounts to merged cells (C20-TEST03)', () => {
      const content = `<table>
<tr><th>날짜</th><th>가맹점</th><th>금액</th></tr>
<tr><td>2024.01.15</td><td>스타벅스</td><td>5,000</td></tr>
<tr><td></td><td>총합계</td><td>999,999</td></tr>
<tr><td>2024.01.16</td><td>이마트</td><td></td></tr>
</table>`;

      const result = parseHTML(content);
      // Summary row resets forward-fill state, so the 이마트 row with empty
      // amount cell gets no forward-fill value and is skipped — ensuring the
      // summary amount 999,999 never propagates to data rows.
      const emartTx = result.transactions.find((t) => t.merchant.includes('이마트'));
      expect(emartTx).toBeUndefined();
      // Also verify no transaction picked up the summary amount
      expect(result.transactions.some((t) => t.amount === 999999)).toBe(false);
    });
  });
});
