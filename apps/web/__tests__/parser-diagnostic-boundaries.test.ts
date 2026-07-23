import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import {
  MAX_PARSE_DIAGNOSTICS,
  MAX_PARSE_DIAGNOSTIC_RAW_LENGTH,
  PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE,
  XLSX_ARCHIVE_REJECTED_ERROR_CODE,
} from '@cherrypicker/parser/browser';
import { parseGenericCSV } from '../../../packages/parser/src/csv/generic.js';
import { parseHTML as parseServerHTML } from '../../../packages/parser/src/html/index.js';
import { parseOFX as parseServerOFX } from '../../../packages/parser/src/ofx/index.js';
import { parsePDFText } from '../../../packages/parser/src/shared/pdf-text.js';
import { parseXLSXBuffer } from '../../../packages/parser/src/xlsx/index.js';
import { parseCSV as parseWebCSV } from '../src/lib/parser/csv.js';
import { parseHTML as parseWebHTML } from '../src/lib/parser/html.js';
import { parseOFX as parseWebOFX } from '../src/lib/parser/ofx.js';
import { parseXLSX as parseWebXLSX } from '../src/lib/parser/xlsx.js';

interface DiagnosticResult {
  errors: Array<{ code?: string; count?: number }>;
  transactions: unknown[];
}

function expectExactBoundary(...results: DiagnosticResult[]): void {
  for (const result of results) {
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(MAX_PARSE_DIAGNOSTICS);
    expect(result.errors.at(-1)).toMatchObject({
      code: PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE,
      count: 51,
    });
  }
}

describe('server/browser parser diagnostic boundaries', () => {
  test('bounds CSV bad-row diagnostics at their source', () => {
    const invalidRows = Array.from(
      { length: 150 },
      (_, index) =>
        `2026-07-01,${
          index === 0 ? '가'.repeat(5_000) : `테스트 ${index}`
        },not-an-amount`,
    );
    const content = [
      'date,merchant,amount',
      ...invalidRows,
      '2026-07-02,정상 거래,10000',
    ].join('\n');

    const server = parseGenericCSV(content, null);
    const web = parseWebCSV(content);
    expectExactBoundary(server, web);
    expect(server.errors[0]?.raw?.length)
      .toBe(MAX_PARSE_DIAGNOSTIC_RAW_LENGTH);
    expect(web.errors[0]?.raw?.length)
      .toBe(MAX_PARSE_DIAGNOSTIC_RAW_LENGTH);
  });

  test('bounds XLSX and HTML bad-row diagnostics at their source', () => {
    const rows = [
      ['date', 'merchant', 'amount'],
      ...Array.from(
        { length: 150 },
        () => ['2026-07-01', ' ', 10_000],
      ),
      ['2026-07-02', '정상 거래', 20_000],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      '내역',
    );
    const bytes = new Uint8Array(
      XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
    );
    const htmlRows = rows.slice(1).map(
      (row) =>
        `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`,
    ).join('');
    const html = `<table>
      <tr><th>date</th><th>merchant</th><th>amount</th></tr>
      ${htmlRows}
    </table>`;

    expectExactBoundary(
      parseXLSXBuffer(bytes),
      parseWebXLSX(bytes.buffer as ArrayBuffer),
      parseServerHTML(html),
      parseWebHTML(html),
    );
  });

  test('bounds OFX and PDF bad-row diagnostics at their source', () => {
    const invalidBlocks = Array.from(
      { length: 150 },
      () =>
        '<STMTTRN><DTPOSTED>20260701</DTPOSTED><TRNAMT>-10000</TRNAMT><NAME> </NAME></STMTTRN>',
    ).join('');
    const ofx = `<CURDEF>KRW<BANKTRANLIST>${invalidBlocks}
      <STMTTRN><DTPOSTED>20260702</DTPOSTED><TRNAMT>-20000</TRNAMT><NAME>정상 거래</NAME></STMTTRN>
      </BANKTRANLIST>`;
    const pdfText = [
      '이용일 이용처 이용금액',
      ...Array.from(
        { length: 150 },
        () => '2026-07-01 "" 10,000원',
      ),
      '2026-07-02 정상 20,000원',
    ].join('\n');

    expectExactBoundary(
      parseServerOFX(ofx),
      parseWebOFX(ofx),
      parsePDFText(pdfText),
    );
  });

  test('browser XLSX entrypoint exposes only the sanitized archive error', () => {
    const malformedPK = new Uint8Array([0x50, 0x4b]);
    const result = parseWebXLSX(malformedPK.buffer);
    expect(result.errors[0]?.code).toBe(XLSX_ARCHIVE_REJECTED_ERROR_CODE);
    expect(result.errors[0]?.message).not.toContain('malformed');
  });
});
