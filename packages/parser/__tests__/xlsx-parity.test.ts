import { describe, expect, test } from 'bun:test';
import { BANK_COLUMN_CONFIGS as backendConfigs } from '../src/xlsx/adapters/index.js';
import { BANK_COLUMN_CONFIGS as webConfigs } from '../../../apps/web/src/lib/parser/xlsx.ts';
import {
  SUMMARY_ROW_PATTERN as serverSummaryPattern,
  HEADER_KEYWORDS as serverHeaderKeywords,
  DATE_COLUMN_PATTERN as serverDatePattern,
  MERCHANT_COLUMN_PATTERN as serverMerchantPattern,
  AMOUNT_COLUMN_PATTERN as serverAmountPattern,
  isValidHeaderRow as serverIsValidHeaderRow,
} from '../src/csv/column-matcher.js';
import {
  SUMMARY_ROW_PATTERN as webSummaryPattern,
  HEADER_KEYWORDS as webHeaderKeywords,
  DATE_COLUMN_PATTERN as webDatePattern,
  MERCHANT_COLUMN_PATTERN as webMerchantPattern,
  AMOUNT_COLUMN_PATTERN as webAmountPattern,
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
});
