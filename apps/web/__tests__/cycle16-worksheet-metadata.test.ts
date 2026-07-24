import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';

import {
  createSheetMergeIndex,
  MAX_MERGE_LOGICAL_CELLS,
  MAX_WORKBOOK_LOGICAL_CELLS,
  MAX_WORKBOOK_MERGED_CELLS,
  MAX_WORKBOOK_MERGES,
  MAX_WORKBOOK_SHEETS,
  MAX_WORKSHEET_COLUMNS,
  MAX_WORKSHEET_LOGICAL_CELLS,
  MAX_WORKSHEET_MERGED_CELLS,
  MAX_WORKSHEET_MERGES,
  MAX_WORKSHEET_ROWS,
  resolveSheetCell,
  validateWorkbookSheetMetadata,
  validateWorksheetMetadata,
  WorksheetMetadataValidationError,
  WORKSHEET_METADATA_REJECTED_ERROR_CODE,
  WORKSHEET_METADATA_REJECTED_MESSAGE,
} from '@cherrypicker/parser/browser';
import {
  parseHTML as parseServerHTML,
  parseHTMLSheet as parseServerHTMLSheet,
} from '../../../packages/parser/src/html/index.js';
import { parseXLSXBuffer as parseServerXLSX } from '../../../packages/parser/src/xlsx/index.js';
import {
  parseHTML as parseBrowserHTML,
  parseHTMLSheet as parseBrowserHTMLSheet,
} from '../src/lib/parser/html.js';
import { parseXLSX as parseBrowserXLSX } from '../src/lib/parser/xlsx.js';

const REJECTED_CODE = 'worksheet_metadata_rejected';
const REJECTED_MESSAGE = '표의 행, 열 또는 병합 범위가 너무 커서 읽지 않았어요.';

interface ParserResult {
  transactions: unknown[];
  errors: Array<{ code?: string; format?: string; message: string }>;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function writeWorkbook(
  workbook: XLSX.WorkBook,
  bookType: 'xlsx' | 'xls' = 'xlsx',
): Uint8Array {
  return new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType }) as ArrayBuffer,
  );
}

function rewriteWorksheetDimensions(
  bytes: Uint8Array,
  references: readonly string[],
): Uint8Array {
  const container = XLSX.CFB.read(bytes, { type: 'buffer' });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  references.forEach((reference, index) => {
    const entry = XLSX.CFB.find(
      container,
      `/xl/worksheets/sheet${index + 1}.xml`,
    );
    if (!entry?.content) {
      throw new Error(`worksheet ${index + 1} was not found`);
    }
    const xml = decoder.decode(entry.content);
    const dimensionPattern = /<dimension ref="[^"]*"\/>/;
    if (!dimensionPattern.test(xml)) {
      throw new Error(`worksheet ${index + 1} has no dimension`);
    }
    const updated = xml.replace(
      dimensionPattern,
      `<dimension ref="${reference}"/>`,
    );
    entry.content = encoder.encode(updated);
    entry.size = entry.content.byteLength;
  });

  return new Uint8Array(
    XLSX.CFB.write(container, { type: 'buffer', fileType: 'zip' }),
  );
}

function expectRejected(
  expectedFormat: 'html' | 'xlsx',
  ...results: ParserResult[]
): void {
  for (const result of results) {
    expect(result.transactions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: REJECTED_CODE,
      format: expectedFormat,
      message: REJECTED_MESSAGE,
    });
  }
}

type WorksheetMetadata = Parameters<typeof validateWorksheetMetadata>[0];
type WorkbookMetadata = Parameters<typeof validateWorkbookSheetMetadata>[0];

function workbookMetadata(
  sheets: readonly WorksheetMetadata[],
): WorkbookMetadata {
  const SheetNames = sheets.map((_, index) => `Sheet${index + 1}`);
  return {
    SheetNames,
    Sheets: Object.fromEntries(
      SheetNames.map((name, index) => [name, sheets[index]]),
    ),
  };
}

function expectInvalidWorksheet(sheet: WorksheetMetadata): void {
  expect(() => validateWorksheetMetadata(sheet))
    .toThrow(WorksheetMetadataValidationError);
}

function expectInvalidWorkbook(workbook: WorkbookMetadata): void {
  expect(() => validateWorkbookSheetMetadata(workbook))
    .toThrow(WorksheetMetadataValidationError);
}

function columnLabel(oneBasedColumn: number): string {
  let value = oneBasedColumn;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function htmlHeaderCells(count: number): string {
  const required = ['이용일', '이용처', '이용금액'];
  return Array.from(
    { length: count },
    (_, index) => `<th>${required[index] ?? `열${index + 1}`}</th>`,
  ).join('');
}

function mergeRange(
  rows: number,
  columns: number,
  startRow = 0,
  startColumn = 0,
) {
  return {
    s: { r: startRow, c: startColumn },
    e: {
      r: startRow + rows - 1,
      c: startColumn + columns - 1,
    },
  };
}

describe('Cycle 16 large worksheet metadata bounds', () => {
  test('exports the documented shared limits and stable parser result', () => {
    expect({
      sheets: MAX_WORKBOOK_SHEETS,
      rows: MAX_WORKSHEET_ROWS,
      columns: MAX_WORKSHEET_COLUMNS,
      sheetCells: MAX_WORKSHEET_LOGICAL_CELLS,
      workbookCells: MAX_WORKBOOK_LOGICAL_CELLS,
      sheetMerges: MAX_WORKSHEET_MERGES,
      workbookMerges: MAX_WORKBOOK_MERGES,
      mergeCells: MAX_MERGE_LOGICAL_CELLS,
      sheetMergedCells: MAX_WORKSHEET_MERGED_CELLS,
      workbookMergedCells: MAX_WORKBOOK_MERGED_CELLS,
    }).toEqual({
      sheets: 64,
      rows: 100_000,
      columns: 256,
      sheetCells: 1_000_000,
      workbookCells: 2_000_000,
      sheetMerges: 10_000,
      workbookMerges: 20_000,
      mergeCells: 10_000,
      sheetMergedCells: 100_000,
      workbookMergedCells: 200_000,
    });
    expect(WORKSHEET_METADATA_REJECTED_ERROR_CODE).toBe(REJECTED_CODE);
    expect(WORKSHEET_METADATA_REJECTED_MESSAGE).toBe(REJECTED_MESSAGE);
  });

  test('accepts exact workbook, row, and column limits and rejects one over', () => {
    const exactSheets = workbookMetadata(
      Array.from({ length: MAX_WORKBOOK_SHEETS }, () => ({})),
    );
    expect(() => validateWorkbookSheetMetadata(exactSheets)).not.toThrow();
    expectInvalidWorkbook(workbookMetadata([
      ...Array.from({ length: MAX_WORKBOOK_SHEETS }, () => ({})),
      {},
    ]));

    expect(() => validateWorksheetMetadata({
      '!ref': `A${MAX_WORKSHEET_ROWS}`,
    })).not.toThrow();
    expectInvalidWorksheet({
      '!ref': `A${MAX_WORKSHEET_ROWS + 1}`,
    });

    expect(() => validateWorksheetMetadata({
      '!ref': `${columnLabel(MAX_WORKSHEET_COLUMNS)}1`,
    })).not.toThrow();
    expectInvalidWorksheet({
      '!ref': `${columnLabel(MAX_WORKSHEET_COLUMNS + 1)}1`,
    });
  });

  test('checks per-sheet and cumulative logical-cell totals', () => {
    const logicalWidth = 125;
    const logicalRows = MAX_WORKSHEET_LOGICAL_CELLS / logicalWidth;
    expect(Number.isInteger(logicalRows)).toBe(true);
    const exactRef = `A1:${columnLabel(logicalWidth)}${logicalRows}`;

    expect(() => validateWorksheetMetadata({ '!ref': exactRef }))
      .not.toThrow();
    expect(101 * 9901).toBe(MAX_WORKSHEET_LOGICAL_CELLS + 1);
    expectInvalidWorksheet({
      '!ref': `A1:${columnLabel(101)}9901`,
    });

    const exactWorkbook = workbookMetadata([
      { '!ref': exactRef },
      { '!ref': exactRef },
    ]);
    expect(() => validateWorkbookSheetMetadata(exactWorkbook)).not.toThrow();
    expectInvalidWorkbook(workbookMetadata([
      { '!ref': exactRef },
      { '!ref': exactRef },
      { '!ref': 'A1' },
    ]));
  });

  test('rejects malformed A1 metadata and accepts a missing used range', () => {
    expect(() => validateWorksheetMetadata({})).not.toThrow();
    expect(() => validateWorkbookSheetMetadata({
      SheetNames: [],
      Sheets: {},
    })).not.toThrow();

    for (const ref of [
      '',
      'A0',
      '1A',
      'A1:',
      ':A1',
      'A1:B2:C3',
      'B2:A1',
      'A1:A9007199254740992',
      'Sheet1!A1',
    ]) {
      expectInvalidWorksheet({ '!ref': ref });
    }
    expectInvalidWorksheet({ '!ref': 42 } as unknown as WorksheetMetadata);
    expectInvalidWorksheet([] as unknown as WorksheetMetadata);
    expectInvalidWorkbook({
      SheetNames: [],
      Sheets: [],
    } as unknown as WorkbookMetadata);
    expectInvalidWorksheet({
      '!merges': {},
    } as unknown as WorksheetMetadata);
    for (const merge of [
      null,
      {},
      { s: null, e: { r: 0, c: 0 } },
      { s: { r: 0, c: 0 }, e: null },
    ]) {
      expectInvalidWorksheet({ '!merges': [merge] });
    }
  });

  test('checks numeric merge endpoints and per-merge coverage', () => {
    expect(73 * 137).toBe(MAX_MERGE_LOGICAL_CELLS + 1);
    const exact = mergeRange(100, 100);
    expect(() => validateWorksheetMetadata({ '!merges': [exact] }))
      .not.toThrow();
    expectInvalidWorksheet({
      '!merges': [mergeRange(73, 137)],
    });
    expectInvalidWorksheet({
      '!merges': [
        {
          s: { r: 0, c: 0 },
          e: { r: MAX_WORKSHEET_ROWS, c: 0 },
        },
      ],
    });
    expectInvalidWorksheet({
      '!merges': [
        {
          s: { r: 0, c: 0 },
          e: { r: 0, c: MAX_WORKSHEET_COLUMNS },
        },
      ],
    });

    const invalidRanges = [
      { s: { r: -1, c: 0 }, e: { r: 0, c: 0 } },
      { s: { r: 1, c: 0 }, e: { r: 0, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 0, c: 0 } },
      { s: { r: 0.5, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: Number.NaN, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: Number.POSITIVE_INFINITY }, e: { r: 1, c: 0 } },
      {
        s: { r: Number.MAX_SAFE_INTEGER + 1, c: 0 },
        e: { r: Number.MAX_SAFE_INTEGER + 1, c: 0 },
      },
    ];
    for (const range of invalidRanges) {
      expectInvalidWorksheet({ '!merges': [range] });
    }
  });

  test('checks per-sheet merge counts and merged-cell totals', () => {
    const oneCell = mergeRange(1, 1);
    const exactMergeCount = Array.from(
      { length: MAX_WORKSHEET_MERGES },
      () => oneCell,
    );
    expect(() => validateWorksheetMetadata({
      '!merges': exactMergeCount,
    })).not.toThrow();
    expectInvalidWorksheet({
      '!merges': [...exactMergeCount, oneCell],
    });

    const block = mergeRange(100, 100);
    const exactMergedCells = Array.from(
      { length: MAX_WORKSHEET_MERGED_CELLS / MAX_MERGE_LOGICAL_CELLS },
      () => block,
    );
    expect(() => validateWorksheetMetadata({
      '!merges': exactMergedCells,
    })).not.toThrow();
    expectInvalidWorksheet({
      '!merges': [...exactMergedCells, oneCell],
    });
  });

  test('checks cumulative workbook merge counts and merged-cell totals', () => {
    const oneCell = mergeRange(1, 1);
    const sheetMergeCount = Array.from(
      { length: MAX_WORKSHEET_MERGES },
      () => oneCell,
    );
    expect(() => validateWorkbookSheetMetadata(workbookMetadata([
      { '!merges': sheetMergeCount },
      { '!merges': sheetMergeCount },
    ]))).not.toThrow();
    expectInvalidWorkbook(workbookMetadata([
      { '!merges': sheetMergeCount },
      { '!merges': sheetMergeCount },
      { '!merges': [oneCell] },
    ]));

    const block = mergeRange(100, 100);
    const sheetMergedCells = Array.from(
      { length: MAX_WORKSHEET_MERGED_CELLS / MAX_MERGE_LOGICAL_CELLS },
      () => block,
    );
    expect(() => validateWorkbookSheetMetadata(workbookMetadata([
      { '!merges': sheetMergedCells },
      { '!merges': sheetMergedCells },
    ]))).not.toThrow();
    expectInvalidWorkbook(workbookMetadata([
      { '!merges': sheetMergedCells },
      { '!merges': sheetMergedCells },
      { '!merges': [oneCell] },
    ]));
  });

  test('checks every XLSX sheet before selecting a valid earlier sheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['이용일', '이용처', '이용금액'],
        ['2026-07-24', '정상 거래', 10_000],
      ]),
      '정상',
    );
    const laterSheet = XLSX.utils.aoa_to_sheet([['later']]);
    laterSheet['!ref'] = 'A1:IW1';
    XLSX.utils.book_append_sheet(workbook, laterSheet, '나중');

    const bytes = writeWorkbook(workbook);
    expectRejected(
      'xlsx',
      parseServerXLSX(bytes),
      parseBrowserXLSX(asArrayBuffer(bytes)),
    );
  });

  test('applies cumulative logical-cell totals at both XLSX entry points', () => {
    const workbook = XLSX.utils.book_new();
    for (let index = 0; index < 3; index++) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([[index]]),
        `Sheet${index + 1}`,
      );
    }
    const logicalWidth = 125;
    const logicalRows = MAX_WORKSHEET_LOGICAL_CELLS / logicalWidth;
    const exactRef = `A1:${columnLabel(logicalWidth)}${logicalRows}`;
    const bytes = rewriteWorksheetDimensions(
      writeWorkbook(workbook),
      [exactRef, exactRef, 'A1'],
    );

    expectRejected(
      'xlsx',
      parseServerXLSX(bytes),
      parseBrowserXLSX(asArrayBuffer(bytes)),
    );
  });

  test('returns one stable result for direct HTML and HTML-as-spreadsheet', () => {
    const cells = htmlHeaderCells(257);
    const html = `<table><tr>${cells}</tr></table>`;
    const bytes = new TextEncoder().encode(html);

    expectRejected(
      'html',
      parseServerHTML(html),
      parseBrowserHTML(html),
    );
    expectRejected(
      'xlsx',
      parseServerXLSX(bytes),
      parseBrowserXLSX(asArrayBuffer(bytes)),
    );
  });

  test('checks later HTML tables before returning an earlier valid table', () => {
    const html = `
      <table>
        <tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
        <tr><td>2026-07-24</td><td>정상 거래</td><td>10000</td></tr>
      </table>
      <table><tr>${htmlHeaderCells(257)}</tr></table>
    `;
    const bytes = new TextEncoder().encode(html);

    expectRejected(
      'html',
      parseServerHTML(html),
      parseBrowserHTML(html),
    );
    expectRejected(
      'xlsx',
      parseServerXLSX(bytes),
      parseBrowserXLSX(asArrayBuffer(bytes)),
    );
  });

  test('applies the workbook sheet limit to legacy spreadsheets', () => {
    const workbook = XLSX.utils.book_new();
    for (let index = 0; index < 65; index++) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([[index]]),
        `Sheet${index + 1}`,
      );
    }
    const bytes = writeWorkbook(workbook, 'xls');

    expectRejected(
      'xlsx',
      parseServerXLSX(bytes),
      parseBrowserXLSX(asArrayBuffer(bytes)),
    );
  });

  test('preserves ordinary legacy spreadsheet parity', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['이용일', '이용처', '이용금액'],
        ['2026-07-24', '정상 거래', 10_000],
      ]),
      'Sheet1',
    );
    const bytes = writeWorkbook(workbook, 'xls');
    const server = parseServerXLSX(bytes);
    const browser = parseBrowserXLSX(asArrayBuffer(bytes));

    expect(browser.transactions).toEqual(server.transactions);
    expect(browser.errors).toEqual(server.errors);
    expect(server.transactions).toEqual([
      { date: '2026-07-24', merchant: '정상 거래', amount: 10_000 },
    ]);
  });

  test('rejects direct server and browser HTML sheet calls before conversion', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['이용일', '이용처', '이용금액'],
      ['2026-07-24', '정상 거래', 10_000],
    ]);
    sheet['!ref'] = 'A1:IW2';

    expectRejected(
      'html',
      parseServerHTMLSheet(sheet, null),
      parseBrowserHTMLSheet(sheet, null),
    );
  });

  test('stores merge lookup as ordered row intervals', () => {
    const index = createSheetMergeIndex([
      { s: { r: 0, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    ]);

    expect(index.size).toBe(2);
    expect(index.get(0)).toHaveLength(2);
    expect(index.get(1)).toHaveLength(1);

    const resolved = resolveSheetCell(
      [['first', 'later', '', ''], ['', '', '', '']],
      0,
      2,
      index,
    );
    expect(resolved).toEqual({
      value: 'later',
      sourceKey: '0:1',
      fromMerge: true,
    });

    const earlier = resolveSheetCell(
      [['first', 'later', '', ''], ['', '', '', '']],
      0,
      3,
      index,
    );
    expect(earlier).toEqual({
      value: 'first',
      sourceKey: '0:0',
      fromMerge: true,
    });
  });

  test('enforces every per-sheet limit for direct merge-index callers', () => {
    const oneCell = mergeRange(1, 1);
    const exactLastCell = mergeRange(
      1,
      1,
      MAX_WORKSHEET_ROWS - 1,
      MAX_WORKSHEET_COLUMNS - 1,
    );
    expect(createSheetMergeIndex([exactLastCell]).size).toBe(1);
    expect(() => createSheetMergeIndex([
      mergeRange(1, 1, MAX_WORKSHEET_ROWS, 0),
    ])).toThrow(WorksheetMetadataValidationError);
    expect(() => createSheetMergeIndex([
      mergeRange(1, 1, 0, MAX_WORKSHEET_COLUMNS),
    ])).toThrow(WorksheetMetadataValidationError);

    const exactMergeCount = Array.from(
      { length: MAX_WORKSHEET_MERGES },
      () => oneCell,
    );
    expect(createSheetMergeIndex(exactMergeCount).get(0))
      .toHaveLength(MAX_WORKSHEET_MERGES);
    expect(() => createSheetMergeIndex([
      ...exactMergeCount,
      oneCell,
    ])).toThrow(WorksheetMetadataValidationError);

    const block = mergeRange(100, 100);
    const exactMergedCells = Array.from(
      { length: MAX_WORKSHEET_MERGED_CELLS / MAX_MERGE_LOGICAL_CELLS },
      () => block,
    );
    expect(createSheetMergeIndex(exactMergedCells).size).toBe(100);
    expect(() => createSheetMergeIndex([
      ...exactMergedCells,
      oneCell,
    ])).toThrow(WorksheetMetadataValidationError);
    expect(() => createSheetMergeIndex([
      mergeRange(73, 137),
    ])).toThrow(WorksheetMetadataValidationError);
    expect(() => createSheetMergeIndex([
      { s: { r: 0, c: 0 }, e: null },
    ] as never)).toThrow(WorksheetMetadataValidationError);
    expect(() => createSheetMergeIndex([
      { s: { r: 0, c: 1 }, e: { r: 0, c: 0 } },
    ])).toThrow(WorksheetMetadataValidationError);
  });

  test('preserves ordinary merged-table behavior on server and browser', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['이용일', '이용처', '이용금액'],
      ['2026-07-24', '첫 거래', 10_000],
      ['', '둘째 거래', 20_000],
    ]);
    sheet['!merges'] = [
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    ];

    const server = parseServerHTMLSheet(sheet, null);
    const browser = parseBrowserHTMLSheet(sheet, null);
    expect(browser.transactions).toEqual(server.transactions);
    expect(browser.errors).toEqual(server.errors);
    expect(server.transactions).toEqual([
      { date: '2026-07-24', merchant: '첫 거래', amount: 10_000 },
      { date: '2026-07-24', merchant: '둘째 거래', amount: 20_000 },
    ]);
  });
});
