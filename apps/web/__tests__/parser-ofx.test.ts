/**
 * Web-side OFX/QFX parser tests.
 * Parity with server-side packages/parser/__tests__/ofx.test.ts (T13-01, T13-03).
 */
import { describe, it, expect } from 'bun:test';
import { parseOFX } from '../src/lib/parser/ofx.js';

describe('OFX Parser (web)', () => {
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

    it('converts negative amounts to positive and skips positive amounts (T13-03)', () => {
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
  });

  describe('Edge cases', () => {
    it('returns error for empty OFX content', () => {
      const result = parseOFX('OFXHEADER:100\nDATA:OFXSGML');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain('거래 내역을 찾을 수 없습니다');
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
  });
});
