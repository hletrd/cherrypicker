import { describe, it, expect } from 'bun:test';
import { parseOFX as parseRawOFX } from '../src/ofx/index.js';

function parseOFX(content: string) {
  return parseRawOFX(`<CURDEF>KRW</CURDEF>${content}`);
}

describe('OFX Parser', () => {
  describe('OFX 1.x (SGML-style)', () => {
    it('parses basic SGML OFX transactions', () => {
      const content = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<BANKTRANLIST>
<DTSTART>20240101
<DTEND>20240131
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-15000.00
<NAME>STARBUCKS 강남점
<MEMO>커피 구매
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240120
<TRNAMT>-45000.00
<NAME>이마트 죽전점
<MEMO>생활용품
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.format).toBe('ofx');
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
      expect(result.transactions[0]!.merchant).toBe('STARBUCKS 강남점');
      expect(result.transactions[0]!.amount).toBe(15000);
      expect(result.transactions[0]!.memo).toBe('커피 구매');
      expect(result.transactions[1]!.date).toBe('2024-01-20');
      expect(result.transactions[1]!.merchant).toBe('이마트 죽전점');
      expect(result.transactions[1]!.amount).toBe(45000);
    });

    it('skips positive amounts (credits/payments) and converts negative to positive', () => {
      // In OFX: negative = charges (money out), positive = credits (money in)
      const content = `<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240115
<TRNAMT>15000.00
<NAME>REFUND
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240120
<TRNAMT>-30000.00
<NAME>SHOPPING
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('SHOPPING');
      expect(result.transactions[0]!.amount).toBe(30000);
    });

    it('uses MEMO as fallback merchant when NAME is empty', () => {
      const content = `<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-10000.00
<MEMO>카카오톡 선물하기
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('카카오톡 선물하기');
    });

    it('handles TRNTYPE category mapping', () => {
      const content = `<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>POS
<DTPOSTED>20240115
<TRNAMT>-5000.00
<NAME>CU 편의점
</STMTTRN>
<STMTTRN>
<TRNTYPE>ATM
<DTPOSTED>20240116
<TRNAMT>-50000.00
<NAME>ATM 출금
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.transactions[0]!.category).toBe('POS');
      expect(result.transactions[1]!.category).toBe('ATM');
    });
  });

  describe('OFX 2.x (XML-style)', () => {
    it('parses XML-style OFX transactions', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115</DTPOSTED><TRNAMT>-25000.00</TRNAMT><NAME>쿠팡</NAME><MEMO>온라인 쇼핑</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240120</DTPOSTED><TRNAMT>-8000.00</TRNAMT><NAME>맥도날드</NAME></STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const result = parseOFX(content);
      expect(result.format).toBe('ofx');
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
      expect(result.transactions[0]!.merchant).toBe('쿠팡');
      expect(result.transactions[0]!.amount).toBe(25000);
      expect(result.transactions[0]!.memo).toBe('온라인 쇼핑');
      expect(result.transactions[1]!.merchant).toBe('맥도날드');
    });

    it('handles datetime format with time suffix', () => {
      const content = `<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115120000[0:GMT]</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
    });

    it('converts timezone offset to KST date', () => {
      // 2024-01-15 23:00:00 EST (-5) = 2024-01-16 13:00:00 KST (+9)
      const content = `<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115230000[-5:EST]</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.date).toBe('2024-01-16');
    });

    it('handles positive timezone offset to KST', () => {
      // 2024-01-16 01:00:00 JST (+9) = same time in KST
      const content = `<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240116010000[+9:JST]</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.date).toBe('2024-01-16');
    });

    it('preserves date for time-only entries without timezone (C41-BUG01)', () => {
      // 20240115230000 (no timezone) — treated as KST, date should stay 2024-01-15
      const content = `<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115230000</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
    });

    it('shifts date for entries with timezone offset (C41-BUG01)', () => {
      // 20240115 23:00 UTC+0 = 2024-01-16 08:00 KST
      const content = `<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115230000[0:GMT]</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.date).toBe('2024-01-16');
    });
  });

  describe('Edge cases', () => {
    it('rejects a missing or unsupported statement currency', () => {
      const transaction = `<BANKTRANLIST>
<STMTTRN><DTPOSTED>20240115</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>`;

      const missing = parseRawOFX(transaction);
      expect(missing.transactions).toEqual([]);
      expect(missing.errors[0]?.code).toBe('ofx_missing_currency');

      const foreign = parseRawOFX(`<CURDEF>usd</CURDEF>${transaction}`);
      expect(foreign.transactions).toEqual([]);
      expect(foreign.errors[0]?.code).toBe('ofx_unsupported_currency');
    });

    it('returns error for empty OFX content', () => {
      const result = parseOFX('OFXHEADER:100\nDATA:OFXSGML');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain('거래 내역을 찾을 수 없습니다');
    });

    it('returns error for malformed OFX', () => {
      const result = parseOFX('this is not OFX content');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('handles amounts with commas', () => {
      const content = `<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-1,234,567.00
<NAME>대형마트
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.amount).toBe(1234567);
    });

    it('reports unparseable dates', () => {
      const content = `<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>INVALID
<TRNAMT>-10000
<NAME>TEST
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.some((e) => e.message.includes('날짜를 해석할 수 없습니다'))).toBe(true);
    });

    it('detects bank from Korean content', () => {
      const content = `<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-10000
<NAME>신한카드 가맹점
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.bank).toBe('shinhan');
    });

    it('handles zero amounts by skipping', () => {
      const content = `<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>0.00
<NAME>BALANCE CHECK
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240116
<TRNAMT>-5000
<NAME>SHOPPING
</STMTTRN>
</BANKTRANLIST>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.merchant).toBe('SHOPPING');
    });

    it('parses credit card OFX with CREDITCARDMSGSRSV1 (C99-03)', () => {
      // Credit card OFX files use CREDITCARDMSGSRSV1/CCSTMTTRNRS/CCSTMTRS
      // instead of BANKMSGSRSV1/STMTTRNRS/STMTRS (C99-03).
      const content = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-15000.00
<NAME>신한카드 Starbucks
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240120
<TRNAMT>-45000.00
<NAME>이마트
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>`;

      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]!.date).toBe('2024-01-15');
      expect(result.transactions[0]!.merchant).toBe('신한카드 Starbucks');
      expect(result.transactions[0]!.amount).toBe(15000);
      expect(result.transactions[1]!.merchant).toBe('이마트');
      expect(result.transactions[1]!.amount).toBe(45000);
    });

    it('detects bank from OFX ORG tag (C99-03)', () => {
      const content = `<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<FI>
<ORG>신한카드
<FID>12345
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-10000
<NAME>테스트
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = parseOFX(content);
      expect(result.bank).toBe('shinhan');
    });

    it('skips Infinity amounts as unparseable (C10-02)', () => {
      const content = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>1e309
<NAME>테스트</NAME>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
      const result = parseOFX(content);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles tags with regex metacharacters gracefully (C20-TEST02)', () => {
      // Malformed OFX with regex metacharacters in tag names — should not throw
      const content = `<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240115</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME+>STARBUCKS</NAME+></STMTTRN>
</BANKTRANLIST>`;
      // After escapeRegExp fix, this parses without SyntaxError
      const result = parseOFX(content);
      // NAME+ won't match NAME extraction, so merchant falls back to empty/MEMO
      expect(result.transactions.length).toBeGreaterThanOrEqual(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

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
});
