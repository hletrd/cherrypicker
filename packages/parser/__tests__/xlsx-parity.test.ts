import { describe, expect, test } from 'bun:test';
import { BANK_COLUMN_CONFIGS as backendConfigs } from '../src/xlsx/adapters/index.js';
import {
  BANK_COLUMN_CONFIGS as webConfigs,
  isHTMLContent as webIsHTMLContent,
  parseDateToISO as webParseDateToISO,
} from '../../../apps/web/src/lib/parser/xlsx.ts';
import {
  isHTMLContent as serverIsHTMLContent,
  parseDateToISO as serverParseDateToISO,
} from '../src/xlsx/index.js';
import { parseAmountString as serverParseAmountString } from '../src/csv/shared.js';
import { parseAmountString as webParseAmountString } from '../../../apps/web/src/lib/parser/csv.ts';
import { HTML_XLS_SNIFF_BYTES } from '../src/shared/format-detection.js';
import {
  SUMMARY_ROW_PATTERN as serverSummaryPattern,
  HEADER_KEYWORDS as serverHeaderKeywords,
  DATE_COLUMN_PATTERN as serverDatePattern,
  MERCHANT_COLUMN_PATTERN as serverMerchantPattern,
  AMOUNT_COLUMN_PATTERN as serverAmountPattern,
  INSTALLMENTS_COLUMN_PATTERN as serverInstallmentsPattern,
  CATEGORY_COLUMN_PATTERN as serverCategoryPattern,
  MEMO_COLUMN_PATTERN as serverMemoPattern,
  DATE_KEYWORDS as serverDateKeywords,
  MERCHANT_KEYWORDS as serverMerchantKeywords,
  AMOUNT_KEYWORDS as serverAmountKeywords,
  isValidHeaderRow as serverIsValidHeaderRow,
} from '../src/csv/column-matcher.js';
import {
  SUMMARY_ROW_PATTERN as webSummaryPattern,
  HEADER_KEYWORDS as webHeaderKeywords,
  DATE_COLUMN_PATTERN as webDatePattern,
  MERCHANT_COLUMN_PATTERN as webMerchantPattern,
  AMOUNT_COLUMN_PATTERN as webAmountPattern,
  INSTALLMENTS_COLUMN_PATTERN as webInstallmentsPattern,
  CATEGORY_COLUMN_PATTERN as webCategoryPattern,
  MEMO_COLUMN_PATTERN as webMemoPattern,
  DATE_KEYWORDS as webDateKeywords,
  MERCHANT_KEYWORDS as webMerchantKeywords,
  AMOUNT_KEYWORDS as webAmountKeywords,
  isValidHeaderRow as webIsValidHeaderRow,
} from '../../../apps/web/src/lib/parser/column-matcher.ts';

describe('XLSX parser parity', () => {
  test('browser and package parser column configs stay aligned for supported banks', () => {
    expect(Object.keys(webConfigs).sort()).toEqual(Object.keys(backendConfigs).sort());

    for (const bankId of Object.keys(backendConfigs) as Array<keyof typeof backendConfigs>) {
      expect(webConfigs[bankId]).toEqual(backendConfigs[bankId]);
    }
  });

  test('SUMMARY_ROW_PATTERN source is identical between server and web', () => {
    // Both should have the same source string (created from the same regex literal)
    expect(serverSummaryPattern.source).toBe(webSummaryPattern.source);
    expect(serverSummaryPattern.flags).toBe(webSummaryPattern.flags);
  });

  test('HEADER_KEYWORDS arrays are identical between server and web', () => {
    expect(serverHeaderKeywords).toEqual(webHeaderKeywords);
  });

  test('DATE_COLUMN_PATTERN source is identical between server and web', () => {
    expect(serverDatePattern.source).toBe(webDatePattern.source);
  });

  test('MERCHANT_COLUMN_PATTERN source is identical between server and web', () => {
    expect(serverMerchantPattern.source).toBe(webMerchantPattern.source);
  });

  test('AMOUNT_COLUMN_PATTERN source is identical between server and web', () => {
    expect(serverAmountPattern.source).toBe(webAmountPattern.source);
  });

  test('isValidHeaderRow behaves identically on both sides', () => {
    const validHeader = ['이용일', '가맹점명', '이용금액'];
    expect(serverIsValidHeaderRow(validHeader)).toBe(true);
    expect(webIsValidHeaderRow(validHeader)).toBe(true);

    const summaryOnly = ['이용금액', '거래금액', '합계'];
    expect(serverIsValidHeaderRow(summaryOnly)).toBe(false);
    expect(webIsValidHeaderRow(summaryOnly)).toBe(false);

    const englishHeader = ['date', 'merchant', 'amount'];
    expect(serverIsValidHeaderRow(englishHeader)).toBe(true);
    expect(webIsValidHeaderRow(englishHeader)).toBe(true);
  });

  // C78: Verify new patterns are in sync between server and web
  test('INSTALLMENTS_COLUMN_PATTERN source is identical between server and web', () => {
    expect(serverInstallmentsPattern.source).toBe(webInstallmentsPattern.source);
  });

  test('CATEGORY_COLUMN_PATTERN source is identical between server and web', () => {
    expect(serverCategoryPattern.source).toBe(webCategoryPattern.source);
  });

  test('MEMO_COLUMN_PATTERN source is identical between server and web', () => {
    expect(serverMemoPattern.source).toBe(webMemoPattern.source);
  });

  test('DATE_KEYWORDS sets are identical between server and web', () => {
    expect([...serverDateKeywords].sort()).toEqual([...webDateKeywords].sort());
  });

  test('MERCHANT_KEYWORDS sets are identical between server and web', () => {
    expect([...serverMerchantKeywords].sort()).toEqual([...webMerchantKeywords].sort());
  });

  test('AMOUNT_KEYWORDS sets are identical between server and web', () => {
    expect([...serverAmountKeywords].sort()).toEqual([...webAmountKeywords].sort());
  });

  // C21-TEST02: isHTMLContent parity
  test('isHTMLContent detects HTML with DOCTYPE', () => {
    const html = '<!DOCTYPE html><html><body><table></table></body></html>';
    const webBuffer = new TextEncoder().encode(html);
    const serverBuffer = Buffer.from(html);
    expect(webIsHTMLContent(webBuffer)).toBe(true);
    expect(serverIsHTMLContent(serverBuffer)).toBe(true);
  });

  test('isHTMLContent detects HTML with table tag', () => {
    const html = '<table><tr><td>test</td></tr></table>';
    const webBuffer = new TextEncoder().encode(html);
    const serverBuffer = Buffer.from(html);
    expect(webIsHTMLContent(webBuffer)).toBe(true);
    expect(serverIsHTMLContent(serverBuffer)).toBe(true);
  });

  test('isHTMLContent rejects plain text', () => {
    const text = '거래일시,가맹점명,이용금액';
    const webBuffer = new TextEncoder().encode(text);
    const serverBuffer = Buffer.from(text);
    expect(webIsHTMLContent(webBuffer)).toBe(false);
    expect(serverIsHTMLContent(serverBuffer)).toBe(false);
  });

  test('isHTMLContent rejects binary XLSX', () => {
    // XLSX files start with PKZIP signature, not HTML
    const binary = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
    const serverBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    expect(webIsHTMLContent(binary)).toBe(false);
    expect(serverIsHTMLContent(serverBuffer)).toBe(false);
  });

  test('isHTMLContent decodes only the bounded sniff prefix on both routes', () => {
    const payload = new Uint8Array(HTML_XLS_SNIFF_BYTES * 2);
    payload.fill(0x20);
    payload.set(new TextEncoder().encode('<!DOCTYPE html><html>'));
    const decodedLengths: number[] = [];
    const instrumentedDecoder = (bytes: Uint8Array): string => {
      decodedLengths.push(bytes.byteLength);
      return new TextDecoder().decode(bytes);
    };

    expect(
      webIsHTMLContent(payload.buffer as ArrayBuffer, instrumentedDecoder),
    ).toBe(true);
    expect(
      serverIsHTMLContent(Buffer.from(payload), instrumentedDecoder),
    ).toBe(true);
    expect(decodedLengths).toEqual([
      HTML_XLS_SNIFF_BYTES,
      HTML_XLS_SNIFF_BYTES,
    ]);
  });

  // C21-TEST02: parseDateToISO parity
  test('parseDateToISO handles Excel serial number', () => {
    // 45323 = 2024-02-01 in Excel serial date system
    expect(webParseDateToISO(45323)).toBe('2024-02-01');
    expect(serverParseDateToISO(45323)).toBe('2024-02-01');
  });

  test('parseDateToISO handles YYYYMMDD numeric', () => {
    expect(webParseDateToISO(20240115)).toBe('2024-01-15');
    expect(serverParseDateToISO(20240115)).toBe('2024-01-15');
  });

  test('parseDateToISO handles YYMMDD string', () => {
    expect(webParseDateToISO('240115')).toBe('2024-01-15');
    expect(serverParseDateToISO('240115')).toBe('2024-01-15');
  });

  test('parseDateToISO handles ISO date string', () => {
    expect(webParseDateToISO('2024-01-15')).toBe('2024-01-15');
    expect(serverParseDateToISO('2024-01-15')).toBe('2024-01-15');
  });

  test('parseDateToISO handles Korean date format', () => {
    expect(webParseDateToISO('2024년 01월 15일')).toBe('2024-01-15');
    expect(serverParseDateToISO('2024년 01월 15일')).toBe('2024-01-15');
  });

  test('parseDateToISO handles Date object', () => {
    const d = new Date('2024-01-15');
    expect(webParseDateToISO(d)).toBe('2024-01-15');
    expect(serverParseDateToISO(d)).toBe('2024-01-15');
  });

  test('parseDateToISO returns raw string for unparseable input', () => {
    expect(webParseDateToISO('not-a-date')).toBe('not-a-date');
    expect(serverParseDateToISO('not-a-date')).toBe('not-a-date');
  });

  // C21-TEST02: parseAmountString full-width plus parity
  test('parseAmountString parses full-width plus on both sides', () => {
    expect(webParseAmountString('＋1,234')).toBe(1234);
    expect(serverParseAmountString('＋1,234')).toBe(1234);
    expect(webParseAmountString('＋10000')).toBe(10000);
    expect(serverParseAmountString('＋10000')).toBe(10000);
  });
});
