import { beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import iconv from 'iconv-lite';
import xlsx from 'xlsx';
import { MerchantMatcher } from '@cherrypicker/core';
import { loadCategories } from '@cherrypicker/rules';

import { parseFile } from '../../../../apps/web/src/lib/parser/index.js';
import { parseCSV as parseBrowserCSV } from '../../../../apps/web/src/lib/parser/csv.js';
import { detectCSVDelimiter as detectBrowserDelimiter } from '../../../../apps/web/src/lib/parser/detect.js';
import { parseOFX as parseBrowserOFX } from '../../../../apps/web/src/lib/parser/ofx.js';
import { parseXLSX as parseBrowserXLSX } from '../../../../apps/web/src/lib/parser/xlsx.js';
import { parseCSV as parseServerCSV } from '../../src/csv/index.js';
import { parseGenericCSV } from '../../src/csv/generic.js';
import { detectCSVDelimiter as detectServerDelimiter } from '../../src/detect.js';
import { parseOFX as parseServerOFX } from '../../src/ofx/index.js';
import { parseStatement } from '../../src/statement.js';
import { parseXLSXBuffer } from '../../src/xlsx/index.js';
import {
  MAX_REQUIRED_FIELD_ROW_ERRORS,
  REQUIRED_DATE_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_CODE,
} from '../../src/shared/required-fields.js';
import {
  DELIMITER_SAMPLE_CHARACTER_LIMIT,
  sampleNonEmptyDelimitedLines,
} from '../../src/shared/delimiter.js';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function utf16LE(content: string): Uint8Array {
  const bytes = new Uint8Array(2 + content.length * 2);
  bytes[0] = 0xFF;
  bytes[1] = 0xFE;
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < content.length; index++) {
    view.setUint16(2 + index * 2, content.charCodeAt(index), true);
  }
  return bytes;
}

function utf16LEWithoutBOM(content: string): Uint8Array {
  return utf16LE(content).subarray(2);
}

function cp949(content: string): Uint8Array {
  return Uint8Array.from(iconv.encode(content, 'cp949'));
}

async function parseServerFile(fileName: string, payload: Uint8Array) {
  return parseStatement(fileName, undefined, {
    readFile: async () => payload,
    readPrefix: async (_path, maxBytes) => payload.subarray(0, maxBytes),
  });
}

async function parseBrowserFile(fileName: string, payload: Uint8Array) {
  return parseFile(new File([toArrayBuffer(payload)], fileName));
}

function htmlStatement(charset = 'utf-8'): string {
  return `<!doctype html>
<html><head><meta charset="${charset}"></head><body>
<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2026-07-23</td><td>스타벅스</td><td>10000</td></tr>
</table>
</body></html>`;
}

function ofxStatement(encoding = 'UTF-8', charset = 'UTF-8'): string {
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:${encoding}
CHARSET:${charset}

<OFX>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20260723
<TRNAMT>-10000
<NAME>스타벅스
</STMTTRN>
</BANKTRANLIST>
</OFX>`;
}

let matcher: MerchantMatcher;

beforeAll(async () => {
  const categories = await loadCategories(
    join(import.meta.dir, '../../../rules/data/categories.yaml'),
  );
  matcher = new MerchantMatcher(categories);
});

describe('Cycle 5 shared statement encoding contract', () => {
  test.each([
    ['statement.ofx', cp949(ofxStatement('EUC-KR', '949')), 'ofx'],
    ['statement.html', cp949(htmlStatement('euc-kr')), 'html'],
    ['statement.xls', cp949(htmlStatement('euc-kr')), 'xlsx'],
    ['statement.ofx', utf16LE(ofxStatement('UNICODE', 'UTF-16')), 'ofx'],
    ['statement.html', utf16LE(htmlStatement('utf-16')), 'html'],
    ['statement.xls', utf16LE(htmlStatement('utf-16')), 'xlsx'],
  ] as const)(
    'decodes legacy Korean text identically for %s',
    async (fileName, payload, expectedFormat) => {
      const [server, browser] = await Promise.all([
        parseServerFile(fileName, payload),
        parseBrowserFile(fileName, payload),
      ]);

      expect(server.format).toBe(expectedFormat);
      expect(browser.format).toBe(expectedFormat);
      expect(server.transactions).toHaveLength(1);
      expect(browser.transactions).toEqual(server.transactions);
      expect(server.transactions[0]?.merchant).toBe('스타벅스');
      expect(matcher.match(server.transactions[0]!.merchant).category)
        .not.toBe('uncategorized');
    },
  );

  test('accepts BOM-marked UTF-16 JSON on server and browser routes', async () => {
    const payload = utf16LE(JSON.stringify([{
      date: '2026-07-23',
      merchant: '스타벅스',
      amount: 10_000,
    }]));
    const [server, browser] = await Promise.all([
      parseServerFile('statement.json', payload),
      parseBrowserFile('statement.json', payload),
    ]);

    expect(server.transactions).toHaveLength(1);
    expect(browser.transactions).toEqual(server.transactions);
  });

  test('recognizes BOM-marked UTF-16 JSON through CSV aliases', async () => {
    const payload = utf16LE(JSON.stringify([{
      date: '2026-07-23',
      merchant: '스타벅스',
      amount: 10_000,
    }]));
    const [server, browser] = await Promise.all([
      parseServerFile('statement.csv', payload),
      parseBrowserFile('statement.csv', payload),
    ]);

    expect(server.format).toBe('json');
    expect(browser.transactions).toEqual(server.transactions);
  });

  test('rejects CP949 JSON explicitly instead of returning mojibake', async () => {
    const payload = cp949(JSON.stringify([{
      date: '2026-07-23',
      merchant: '스타벅스',
      amount: 10_000,
    }]));

    for (const parsing of [
      parseServerFile('statement.json', payload),
      parseBrowserFile('statement.json', payload),
      parseServerFile('statement.csv', payload),
      parseBrowserFile('statement.csv', payload),
    ]) {
      const error = await parsing.then(
        () => null,
        (reason: unknown) => reason,
      );
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_TEXT_ENCODING',
        format: 'json',
        encoding: 'cp949',
      });
    }
  });

  test.each([
    ['statement.ofx', new TextEncoder().encode(ofxStatement('UNICODE', 'UTF-16')), 'ofx'],
    ['statement.html', new TextEncoder().encode(htmlStatement('utf-16')), 'html'],
    ['statement.xls', new TextEncoder().encode(htmlStatement('utf-16')), 'html'],
  ] as const)(
    'rejects BOM-less UTF-16 declarations for %s',
    async (fileName, payload, errorFormat) => {
      for (const parsing of [
        parseServerFile(fileName, payload),
        parseBrowserFile(fileName, payload),
      ]) {
        const error = await parsing.then(
          () => null,
          (reason: unknown) => reason,
        );
        expect(error).toMatchObject({
          code: 'UNSUPPORTED_TEXT_ENCODING',
          format: errorFormat,
          encoding: 'utf-16le',
        });
      }
    },
  );

  test('rejects BOM-less UTF-16 JSON detected from byte layout', async () => {
    const payload = utf16LEWithoutBOM(JSON.stringify([{
      date: '2026-07-23',
      merchant: '스타벅스',
      amount: 10_000,
    }]));

    for (const parsing of [
      parseServerFile('statement.json', payload),
      parseBrowserFile('statement.json', payload),
    ]) {
      const error = await parsing.then(
        () => null,
        (reason: unknown) => reason,
      );
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_TEXT_ENCODING',
        format: 'json',
        encoding: 'utf-16le',
      });
    }
  });
});

describe('Cycle 5 quote-aware delimiter parity', () => {
  test.each([
    [
      ',',
      [
        '이용일,이용처,이용금액,메모',
        '2026-07-23,카페,10000,"a;b;c;d;e;f;g"',
      ].join('\n'),
    ],
    [
      ';',
      [
        '이용일;이용처;이용금액;메모',
        '2026-07-23;카페;10000;"a,b,c,d,e,f,g"',
      ].join('\n'),
    ],
    [
      '\t',
      [
        '이용일\t이용처\t이용금액\t메모',
        '2026-07-23\t카페\t10000\t"a|b|""quoted;value""|c"',
      ].join('\n'),
    ],
    [
      ',',
      [
        '이용일,이용처,이용금액,메모',
        '2026-07-23,카페,10000,"첫 줄;;;;',
        '둘째 줄||||;"""',
      ].join('\n'),
    ],
  ] as const)('ignores quoted competing punctuation for %s data', (
    expectedDelimiter,
    content,
  ) => {
    expect(detectServerDelimiter(content)).toBe(expectedDelimiter);
    expect(detectBrowserDelimiter(content)).toBe(expectedDelimiter);

    const server = parseServerCSV(content);
    const browser = parseBrowserCSV(content);
    expect(server.transactions).toHaveLength(1);
    expect(browser.transactions).toEqual(server.transactions);
  });

  test('treats quotes inside unquoted fields as literal characters', () => {
    const content = [
      '이용일,이용처,이용금액,메모',
      '2026-07-22,12" pizza,10000,첫 행',
      '2026-07-23,카페,20000,둘째 행',
    ].join('\n');

    expect(detectServerDelimiter(content)).toBe(',');
    expect(detectBrowserDelimiter(content)).toBe(',');
    const server = parseServerCSV(content);
    const browser = parseBrowserCSV(content);
    expect(server.transactions.map((transaction) => transaction.merchant))
      .toEqual(['12" pizza', '카페']);
    expect(browser.transactions).toEqual(server.transactions);
  });

  test('recognizes quoted fields after a competing candidate separator', () => {
    const content = [
      '이용일;"이용처,상호,가맹점";이용금액',
      '2026-07-23;"카페,본점,서울";10000',
    ].join('\n');

    expect(detectServerDelimiter(content)).toBe(';');
    expect(detectBrowserDelimiter(content)).toBe(';');
    const server = parseServerCSV(content);
    const browser = parseBrowserCSV(content);
    expect(server.transactions[0]?.merchant).toBe('카페,본점,서울');
    expect(browser.transactions).toEqual(server.transactions);
  });

  test('bounds delimiter sampling even when a quoted field never closes', () => {
    const content = [
      '이용일,이용처,이용금액,메모',
      `2026-07-23,카페,10000,"${'x'.repeat(
        DELIMITER_SAMPLE_CHARACTER_LIMIT * 2,
      )}`,
    ].join('\n');
    const sample = sampleNonEmptyDelimitedLines(content);

    expect(sample.consumedLength).toBe(DELIMITER_SAMPLE_CHARACTER_LIMIT);
    expect(detectServerDelimiter(content)).toBe(',');
    expect(detectBrowserDelimiter(content)).toBe(',');
  });
});

describe('Cycle 5 required merchant contract', () => {
  test('rejects missing merchant headers in generic and bank CSV paths', () => {
    const generic = [
      '이용일,이용금액',
      '2026-07-23,10000',
    ].join('\n');
    const bank = [
      '삼성카드 이용내역',
      '이용일,이용금액',
      '2026-07-23,10000',
    ].join('\n');

    const results = [
      parseGenericCSV(generic, null),
      parseBrowserCSV(generic),
      parseServerCSV(bank, 'samsung'),
      parseBrowserCSV(bank, 'samsung'),
    ];
    for (const result of results) {
      expect(result.transactions).toHaveLength(0);
      expect(result.errors[0]?.message).toContain('가맹점');
    }
  });

  test('skips blank merchant CSV rows with bounded parity diagnostics', () => {
    const blankRows = Array.from(
      { length: MAX_REQUIRED_FIELD_ROW_ERRORS + 5 },
      (_, index) => `2026-07-${String((index % 28) + 1).padStart(2, '0')}, ,10000`,
    );
    const content = [
      '삼성카드 이용내역',
      '이용일,가맹점명,이용금액',
      ...blankRows,
      '2026-07-23,스타벅스,10000',
    ].join('\n');

    const server = parseServerCSV(content, 'samsung');
    const browser = parseBrowserCSV(content, 'samsung');
    expect(server.transactions.map((transaction) => transaction.merchant))
      .toEqual(['스타벅스']);
    expect(browser.transactions).toEqual(server.transactions);
    expect(
      server.errors.filter((error) => error.code === REQUIRED_MERCHANT_ERROR_CODE),
    ).toHaveLength(MAX_REQUIRED_FIELD_ROW_ERRORS);
    expect(
      browser.errors.map(({ code, line, raw, message }) => ({ code, line, raw, message })),
    ).toEqual(
      server.errors.map(({ code, line, raw, message }) => ({ code, line, raw, message })),
    );
  });

  test('applies the blank merchant row contract to generic CSV too', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-07-22, ,5000',
      '2026-07-23,스타벅스,10000',
    ].join('\n');
    const server = parseGenericCSV(content, null);
    const browser = parseBrowserCSV(content);

    expect(server.transactions.map((transaction) => transaction.merchant))
      .toEqual(['스타벅스']);
    expect(browser.transactions).toEqual(server.transactions);
    expect(server.errors[0]).toMatchObject({
      code: REQUIRED_MERCHANT_ERROR_CODE,
      line: 2,
    });
    expect(browser.errors[0]).toMatchObject({
      code: REQUIRED_MERCHANT_ERROR_CODE,
      line: 2,
    });
  });

  test('reports the physical line after a multiline quoted CSV record', () => {
    const content = [
      '이용일,가맹점명,이용금액,메모',
      '2026-07-22,스타벅스,5000,"첫 줄',
      '둘째 줄"',
      '2026-07-23, ,10000,가맹점 없음',
    ].join('\n');
    const results = [
      parseGenericCSV(content, null),
      parseBrowserCSV(content),
      parseServerCSV(content, 'samsung'),
      parseBrowserCSV(content, 'samsung'),
    ];

    for (const result of results) {
      expect(result.transactions).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        code: REQUIRED_MERCHANT_ERROR_CODE,
        line: 4,
      });
    }
  });

  test('rejects blank and malformed dates in generic and bank CSV paths', () => {
    const content = [
      '이용일,가맹점명,이용금액',
      ' ,날짜 없음,5000',
      'not-a-date,날짜 오류,7000',
      '2026-07-23,정상,10000',
    ].join('\n');
    const results = [
      parseGenericCSV(content, null),
      parseBrowserCSV(content),
      parseServerCSV(content, 'samsung'),
      parseBrowserCSV(content, 'samsung'),
    ];

    const expectedDiagnostics = [
      {
        code: REQUIRED_DATE_ERROR_CODE,
        line: 2,
        message: '필수 값이 비어 있습니다: 날짜',
      },
      {
        code: undefined,
        line: 3,
        message: '날짜를 해석할 수 없습니다: not-a-date',
      },
    ];
    for (const result of results) {
      expect(result.transactions.map((transaction) => transaction.merchant))
        .toEqual(['정상']);
      expect(
        result.errors.map(({ code, line, message }) => ({ code, line, message })),
      ).toEqual(expectedDiagnostics);
    }
  });

  test('rejects missing XLSX merchant headers on server and browser', () => {
    const bytes = workbookBytes([
      ['이용일', '이용금액'],
      ['2026-07-23', 10_000],
    ]);
    const server = parseXLSXBuffer(bytes);
    const browser = parseBrowserXLSX(toArrayBuffer(bytes));

    expect(server.transactions).toHaveLength(0);
    expect(browser.transactions).toHaveLength(0);
    expect(server.errors[0]?.message).toContain('가맹점');
    expect(browser.errors[0]?.message).toBe(server.errors[0]?.message);
  });

  test('skips blank XLSX merchant cells with line-scoped parity errors', () => {
    const bytes = workbookBytes([
      ['이용일', '이용처', '이용금액'],
      ['2026-07-22', '  ', 5_000],
      ['2026-07-23', '스타벅스', 10_000],
    ]);
    const server = parseXLSXBuffer(bytes);
    const browser = parseBrowserXLSX(toArrayBuffer(bytes));

    expect(server.transactions.map((transaction) => transaction.merchant))
      .toEqual(['스타벅스']);
    expect(browser.transactions).toEqual(server.transactions);
    expect(server.errors[0]).toMatchObject({
      code: REQUIRED_MERCHANT_ERROR_CODE,
      line: 2,
    });
    expect(browser.errors[0]).toMatchObject({
      code: REQUIRED_MERCHANT_ERROR_CODE,
      line: 2,
    });
  });
});

function workbookBytes(rows: unknown[][]): Uint8Array {
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.aoa_to_sheet(rows),
    'Sheet1',
  );
  return Uint8Array.from(
    xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  );
}

function ofxBlock(date?: string, amount?: string, merchant = '테스트'): string {
  return `<STMTTRN>
${date === undefined ? '' : `<DTPOSTED>${date}\n`}${amount === undefined ? '' : `<TRNAMT>${amount}\n`}<NAME>${merchant}
</STMTTRN>`;
}

function parseOFXPair(content: string) {
  return [parseServerOFX(content), parseBrowserOFX(content)] as const;
}

describe('Cycle 5 strict OFX conformance', () => {
  test.each([
    ['20241301120000[0:GMT]', 'month'],
    ['20260431120000[0:GMT]', 'day'],
    ['20230229120000[0:GMT]', 'non-leap day'],
    ['20260201240000[0:GMT]', 'hour'],
    ['20260201236000[0:GMT]', 'minute'],
    ['20260201235961[0:GMT]', 'second'],
    ['20260201235959[13:GMT]', 'offset'],
    ['20260201235959[0:GMT]junk', 'trailing junk'],
  ] as const)('rejects invalid %s timestamp components (%s)', (date) => {
    const content = `<OFX>
<BANKTRANLIST>
${ofxBlock(date, '-10000')}
</BANKTRANLIST>
</OFX>`;

    for (const result of parseOFXPair(content)) {
      expect(result.transactions).toHaveLength(0);
      expect(result.errors[0]).toMatchObject({ line: 3 });
      expect(result.errors[0]?.message).toContain('날짜를 해석할 수 없습니다');
    }
  });

  test.each([
    ['20240229120000[0:GMT]', '2024-02-29'],
    ['20260201235959[12:GMT]', '2026-02-01'],
    ['20260201235959[0]', '2026-02-02'],
    ['20260201235959[5.5:IST]', '2026-02-02'],
    ['20260201235959.123[-5:EST]', '2026-02-02'],
    ['20260201235960[0:GMT]', '2026-02-02'],
  ] as const)('accepts valid timestamp %s', (date, expectedDate) => {
    const content = `<OFX><BANKTRANLIST>${ofxBlock(date, '-10000')}</BANKTRANLIST></OFX>`;
    for (const result of parseOFXPair(content)) {
      expect(result.errors).toHaveLength(0);
      expect(result.transactions[0]?.date).toBe(expectedDate);
    }
  });

  test('matches exact transaction and field tags inside OFX wrappers', () => {
    const content = `<OFX>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTEDX>20260722
<TRNAMT>-1000
<NAME>접두사 필드
</STMTTRN>
<STMTTRN>
<DTPOSTED>20260723
<TRNAMT>-10000
<NAME>정상
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</OFX>`;

    for (const result of parseOFXPair(content)) {
      expect(result.transactions.map((transaction) => transaction.merchant))
        .toEqual(['정상']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        code: 'ofx_missing_dtposted',
        line: 5,
      });
    }
  });

  test('diagnoses each missing required field and retains valid rows', () => {
    const content = `<OFX>
<BANKTRANLIST>
${ofxBlock(undefined, '-1000', '날짜 없음')}
${ofxBlock('20260722', undefined, '금액 없음')}
${ofxBlock(undefined, undefined, '둘 다 없음')}
${ofxBlock('20260723', '-10000', '정상')}
</BANKTRANLIST>
</OFX>`;
    const [server, browser] = parseOFXPair(content);

    expect(server.transactions.map((transaction) => transaction.merchant))
      .toEqual(['정상']);
    expect(browser.transactions).toEqual(server.transactions);
    const serverDiagnostics = server.errors.map(
      ({ code, line, message }) => ({ code, line, message }),
    );
    expect(serverDiagnostics).toEqual([
      {
        code: 'ofx_missing_dtposted',
        line: 3,
        message: '필수 OFX 필드가 없습니다: DTPOSTED',
      },
      {
        code: 'ofx_missing_trnamt',
        line: 7,
        message: '필수 OFX 필드가 없습니다: TRNAMT',
      },
      {
        code: 'ofx_missing_dtposted',
        line: 11,
        message: '필수 OFX 필드가 없습니다: DTPOSTED',
      },
      {
        code: 'ofx_missing_trnamt',
        line: 11,
        message: '필수 OFX 필드가 없습니다: TRNAMT',
      },
    ]);
    expect(
      browser.errors.map(({ code, line, message }) => ({ code, line, message })),
    ).toEqual(serverDiagnostics);
  });
});
