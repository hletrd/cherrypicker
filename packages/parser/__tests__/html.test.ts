import { describe, it, expect } from 'bun:test';
import xlsx from 'xlsx';
import { parseHTML, parseHTMLSheet } from '../src/html/index.js';

describe('HTML Table Parser', () => {
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

    // C17-09: normalizeHTML handles broader tag set (div, span, p)
    it('handles HTML with malformed div and span closing tags', () => {
      const content = `<div>
<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>카페</td><td>5,000</td></tr>
</table>
</div   >
<span   >footer</span   >`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('카페');
    });

    it('handles HTML with malformed p closing tags', () => {
      const content = `<p>header</p   >
<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>식당</td><td>12,000</td></tr>
</table>
<p>footer</p   >`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('식당');
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

    it('handles Korean text in HTML entities', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>한식당</td><td>15,000</td></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('한식당');
    });

    it('reports unparseable amounts', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>카페</td><td>invalid</td></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.some((e) => e.message.includes('금액을 해석할 수 없습니다'))).toBe(true);
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

    it('handles installments column', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th><th>할부</th></tr>
<tr><td>2024.01.15</td><td>전자제품</td><td>100,000</td><td>3</td></tr>
</table>`;

      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.installments).toBe(3);
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

    it('parses SheetJS Date objects without locale stringification', () => {
      const sheet = xlsx.utils.aoa_to_sheet([
        ['이용일', '이용처', '이용금액'],
        [new Date(2024, 0, 15), '카페', 5000],
      ]);
      const result = parseHTMLSheet(sheet, null);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
      expect(result.errors).toHaveLength(0);
    });

    it('does not emit a transaction with an invalid Date object', () => {
      const sheet = xlsx.utils.aoa_to_sheet([
        ['이용일', '이용처', '이용금액'],
        [new Date(Number.NaN), '카페', 5000],
      ]);
      const result = parseHTMLSheet(sheet, null);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.some((error) => error.message.includes('날짜'))).toBe(true);
    });

    it('does not fabricate a transaction from an ordinary note row', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>카페</td><td>5,000</td></tr>
<tr><td></td><td>승인 취소 관련 안내</td><td></td></tr>
</table>`;
      const result = parseHTML(content);
      expect(result.transactions).toHaveLength(1);
    });

    it('forward-fills merged cells in HTML tables (C99-02)', () => {
      // Only cells covered by actual rowspan metadata may inherit anchors.
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th><th>할부</th><th>비고</th></tr>
<tr><td rowspan="2">2024.01.15</td><td rowspan="2">스타벅스</td><td>5,500</td><td></td><td></td></tr>
<tr><td>4,500</td><td></td><td></td></tr>
<tr><td rowspan="2">2024.01.20</td><td rowspan="2">이마트</td><td>45,000</td><td rowspan="2">3</td><td rowspan="2">온라인</td></tr>
<tr><td>15,000</td></tr>
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

    it('prevents summary row values from contaminating forward-fill', () => {
      const content = `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2024.01.15</td><td>카페</td><td>5,000</td></tr>
<tr><td></td><td>합계</td><td>5,000</td></tr>
<tr><td>2024.01.16</td><td></td><td>12,000</td></tr>
</table>`;

      const result = parseHTML(content);
      // Summary row resets forward-fill state, so the row after the summary
      // gets no fabricated merchant and is rejected by the required-field
      // boundary.
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('카페');
      expect(result.errors[0]?.code).toBe('missing_required_merchant');
    });

    it('does not forward-fill summary row amounts to merged cells (C25-TEST01)', () => {
      const content = `<table>
<tr><th>날짜</th><th>가맹점</th><th>금액</th></tr>
<tr><td>2024.01.15</td><td>스타벅스</td><td>5,000</td></tr>
<tr><td></td><td>총합계</td><td>999,999</td></tr>
<tr><td>2024.01.16</td><td>이마트</td><td></td></tr>
</table>`;

      const result = parseHTML(content);
      // Summary row resets forward-fill state, so the 이마트 row with empty
      // amount cell gets no forward-fill value and is skipped.
      const emartTx = result.transactions.find((t) => t.merchant.includes('이마트'));
      expect(emartTx).toBeUndefined();
      // Also verify no transaction picked up the summary amount
      expect(result.transactions.some((t) => t.amount === 999999)).toBe(false);
    });
  });
});
