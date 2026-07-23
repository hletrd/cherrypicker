import { describe, expect, test } from 'bun:test';

import { parseHTML as parseBrowserHTML } from '../src/lib/parser/html.js';
import { parseJSON as parseBrowserJSON } from '../src/lib/parser/json.js';
import { parseOFX as parseBrowserOFX } from '../src/lib/parser/ofx.js';
import { parseHTML as parseServerHTML } from '../../../packages/parser/src/html/index.js';
import { parseJSON as parseServerJSON } from '../../../packages/parser/src/json/index.js';
import { parseOFX as parseServerOFX } from '../../../packages/parser/src/ofx/index.js';
import { parsePDFText } from '../../../packages/parser/src/shared/pdf-text.js';
import { MAX_JSON_PARSE_DIAGNOSTICS } from '../../../packages/parser/src/shared/json.js';
import {
  MAX_REQUIRED_FIELD_ROW_ERRORS,
  REQUIRED_MERCHANT_ERROR_CODE,
} from '../../../packages/parser/src/shared/required-fields.js';

function normalize(result: {
  transactions: unknown[];
  errors: Array<{
    code?: string;
    line?: number;
    message: string;
    count?: number;
  }>;
}) {
  return {
    transactions: result.transactions,
    errors: result.errors.map(({ code, line, message, count }) => ({
      code,
      line,
      message,
      count,
    })),
  };
}

describe('Cycle 6 required merchant contract', () => {
  test('JSON skips blank merchants with bounded server/browser diagnostics', () => {
    const rows = Array.from(
      { length: MAX_REQUIRED_FIELD_ROW_ERRORS + 5 },
      (_, index) => ({
        date: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
        merchant: index % 2 === 0 ? '' : '   ',
        amount: 10_000,
      }),
    );
    rows.push({
      date: '2026-07-24',
      merchant: '정상 가맹점',
      amount: 20_000,
    });
    const content = JSON.stringify(rows);
    const server = parseServerJSON(content);
    const browser = parseBrowserJSON(content);

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions.map(({ merchant }) => merchant))
      .toEqual(['정상 가맹점']);
    expect(
      server.errors.filter(
        ({ code }) => code === REQUIRED_MERCHANT_ERROR_CODE,
      ),
    ).toHaveLength(MAX_JSON_PARSE_DIAGNOSTICS - 1);
    expect(server.errors).toHaveLength(MAX_JSON_PARSE_DIAGNOSTICS);
    expect(server.errors.at(-1)).toMatchObject({
      code: 'json_diagnostics_omitted',
      count: 6,
    });
  });

  test('HTML requires a merchant column on server and browser', () => {
    const content = `<!doctype html><html><body><table>
<tr><th>date</th><th>amount</th></tr>
<tr><td>2026-07-24</td><td>10000</td></tr>
</table></body></html>`;
    const server = parseServerHTML(content);
    const browser = parseBrowserHTML(content);

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions).toEqual([]);
    expect(server.errors[0]?.code).toBe(REQUIRED_MERCHANT_ERROR_CODE);
    expect(server.errors[0]?.message).toContain('가맹점');
  });

  test('HTML keeps valid rows and bounds whitespace-only merchant diagnostics', () => {
    const blankRows = Array.from(
      { length: MAX_REQUIRED_FIELD_ROW_ERRORS + 5 },
      () => '<tr><td>2026-07-23</td><td>   </td><td>10000</td></tr>',
    ).join('\n');
    const content = `<!doctype html><html><body><table>
<tr><th>date</th><th>merchant</th><th>amount</th></tr>
${blankRows}
<tr><td>2026-07-24</td><td> 정상 가맹점 </td><td>20000</td></tr>
</table></body></html>`;
    const server = parseServerHTML(content);
    const browser = parseBrowserHTML(content);

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions.map(({ merchant }) => merchant))
      .toEqual(['정상 가맹점']);
    expect(server.errors[0]?.code).toBe(REQUIRED_MERCHANT_ERROR_CODE);
    expect(server.errors).toHaveLength(MAX_REQUIRED_FIELD_ROW_ERRORS);
  });

  test('OFX accepts a nonblank NAME or MEMO and bounds blank diagnostics', () => {
    const blankBlocks = Array.from(
      { length: MAX_REQUIRED_FIELD_ROW_ERRORS + 5 },
      () => '<STMTTRN><DTPOSTED>20260723</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>   </NAME><MEMO>   </MEMO></STMTTRN>',
    ).join('\n');
    const content = `<CURDEF>KRW
<BANKTRANLIST>
${blankBlocks}
<STMTTRN><DTPOSTED>20260724</DTPOSTED><TRNAMT>-20000</TRNAMT><MEMO> 정상 가맹점 </MEMO></STMTTRN>
</BANKTRANLIST>`;
    const server = parseServerOFX(content);
    const browser = parseBrowserOFX(content);

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions.map(({ merchant }) => merchant))
      .toEqual(['정상 가맹점']);
    expect(server.errors[0]?.code).toBe(REQUIRED_MERCHANT_ERROR_CODE);
    expect(server.errors).toHaveLength(MAX_REQUIRED_FIELD_ROW_ERRORS);
  });

  test.each([
    ['missing', '', 'ofx_missing_currency'],
    ['foreign', '<CURDEF>USD</CURDEF>', 'ofx_unsupported_currency'],
  ])('OFX rejects %s currency before emitting transactions', (_name, currency, code) => {
    const content = `${currency}<BANKTRANLIST>
<STMTTRN><DTPOSTED>20260724</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>TEST</NAME></STMTTRN>
</BANKTRANLIST>`;

    for (const result of [
      parseServerOFX(content),
      parseBrowserOFX(content),
    ]) {
      expect(result.transactions).toEqual([]);
      expect(result.errors[0]?.code).toBe(code);
    }
  });

  test.each([
    [
      'SGML bank',
      `<CURDEF>krw
<STMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260724
<TRNAMT>-10000
<NAME>SGML BANK
</STMTTRN></BANKTRANLIST></STMTRS>`,
    ],
    [
      'XML credit card',
      `<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CURDEF>KRW</CURDEF><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260724</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>XML CARD</NAME></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`,
    ],
  ])('OFX accepts explicit KRW in %s statements', (_name, content) => {
    const server = parseServerOFX(content);
    const browser = parseBrowserOFX(content);

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions).toHaveLength(1);
  });

  test('OFX binds every transaction-bearing statement to its own currency', () => {
    const content = `<OFX>
<STMTRS><CURDEF>KRW</CURDEF><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260724</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>KRW 거래</NAME></STMTTRN>
</BANKTRANLIST></STMTRS>
<STMTRS><CURDEF>USD</CURDEF><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260724</DTPOSTED><TRNAMT>-25</TRNAMT><NAME>USD 거래</NAME></STMTTRN>
</BANKTRANLIST></STMTRS>
</OFX>`;

    for (const result of [
      parseServerOFX(content),
      parseBrowserOFX(content),
    ]) {
      expect(result.transactions).toEqual([]);
      expect(result.errors[0]?.code).toBe('ofx_unsupported_currency');
    }
  });

  test.each([
    [
      'nested transaction currency',
      `<OFX><STMTRS><BANKTRANLIST>
<STMTTRN><CURDEF>KRW</CURDEF><DTPOSTED>20260724</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>중첩 통화</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></OFX>`,
    ],
    [
      'one document currency shared by multiple statements',
      `<OFX><CURDEF>KRW</CURDEF>
<STMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260724</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME>첫 거래</NAME></STMTTRN>
</BANKTRANLIST></STMTRS>
<STMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260724</DTPOSTED><TRNAMT>-20000</TRNAMT><NAME>둘째 거래</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></OFX>`,
    ],
  ])('OFX rejects ambiguous %s binding', (_name, content) => {
    for (const result of [
      parseServerOFX(content),
      parseBrowserOFX(content),
    ]) {
      expect(result.transactions).toEqual([]);
      expect(result.errors[0]?.code).toBe('ofx_ambiguous_currency');
    }
  });

  test('structured PDF text rejects a blank merchant instead of inferring another column', () => {
    const parsed = parsePDFText([
      '이용일 이용처 이용금액',
      '2026-07-24 "" 10,000원',
    ].join('\n'));

    expect(parsed.transactions).toEqual([]);
    expect(parsed.errors[0]?.code).toBe(REQUIRED_MERCHANT_ERROR_CODE);
  });

  test('structured PDF text bounds blank-merchant diagnostics and keeps valid rows', () => {
    const parsed = parsePDFText([
      '이용일 이용처 이용금액',
      ...Array.from(
        { length: MAX_REQUIRED_FIELD_ROW_ERRORS + 5 },
        () => '2026-07-23 "" 10,000원',
      ),
      '2026-07-24 정상 20,000원',
    ].join('\n'));

    expect(parsed.transactions.map(({ merchant }) => merchant))
      .toEqual(['정상']);
    expect(parsed.errors).toHaveLength(MAX_REQUIRED_FIELD_ROW_ERRORS);
  });
});
