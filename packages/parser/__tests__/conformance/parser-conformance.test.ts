import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { parseHTML as parseServerHTML } from '../../src/html/index.js';
import { parseOFX as parseServerOFX } from '../../src/ofx/index.js';
import { parseXLSX as parseServerXLSX } from '../../src/xlsx/index.js';
import { parseHTML as parseBrowserHTML } from '../../../../apps/web/src/lib/parser/html.js';
import { parseOFX as parseBrowserOFX } from '../../../../apps/web/src/lib/parser/ofx.js';
import { parseXLSX as parseBrowserXLSX } from '../../../../apps/web/src/lib/parser/xlsx.js';

import { asArrayBuffer, createWorkbookFixture } from './workbook.js';

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/html/${name}`, import.meta.url), 'utf8');
}

function normalize(result: {
  transactions: unknown[];
  errors: Array<{ message: string; code?: string }>;
}) {
  return {
    transactions: result.transactions,
    errors: result.errors.map(({ message, code }) => ({ message, code })),
  };
}

describe('server/browser parser conformance', () => {
  test.each([
    ['iso-hyphen-date.html', 1],
    ['note-row-after-transaction.html', 1],
    ['real-rowspan.html', 2],
  ])('HTML fixture %s has identical facts', (name, transactionCount) => {
    const server = parseServerHTML(fixture(name), 'kb');
    const browser = parseBrowserHTML(fixture(name), 'kb');

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions).toHaveLength(transactionCount);
  });

  test('XLSX ordinary blanks and real merges have identical facts', async () => {
    const workbook = createWorkbookFixture(
      [
        ['이용일', '가맹점명', '이용금액'],
        ['2026-01-01', '정상 거래', 50000],
        ['', '할부 안내 문구', ''],
        ['2026-01-02', '첫 거래', 10000],
        ['', '둘째 거래', 20000],
      ],
      [{ s: { r: 3, c: 0 }, e: { r: 4, c: 0 } }],
    );

    const server = await workbook.withFile((filePath) => parseServerXLSX(filePath, 'kb'));
    const browser = parseBrowserXLSX(asArrayBuffer(workbook.bytes), 'kb');

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions).toHaveLength(3);
  });

  test('XLSX required-column errors are identical', async () => {
    const workbook = createWorkbookFixture([
      ['이용일', '가맹점명'],
      ['2026-01-01', '정상 거래'],
    ]);

    const server = await workbook.withFile((filePath) => parseServerXLSX(filePath, 'kb'));
    const browser = parseBrowserXLSX(asArrayBuffer(workbook.bytes), 'kb');

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions).toEqual([]);
    expect(server.errors[0]?.message).toContain('금액');
  });

  test('OFX invalid DTPOSTED rows are rejected with identical diagnostics', () => {
    const content = `<OFX><CURDEF>KRW
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20241340
<TRNAMT>-10000
<NAME>INVALID DATE
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

    const server = parseServerOFX(content, 'kb');
    const browser = parseBrowserOFX(content, 'kb');

    expect(normalize(browser)).toEqual(normalize(server));
    expect(server.transactions).toEqual([]);
    expect(server.errors).toHaveLength(1);
    expect(server.errors[0]?.message).toContain('날짜를 해석할 수 없습니다');
  });
});
