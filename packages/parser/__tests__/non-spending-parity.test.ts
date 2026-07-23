/**
 * Parity tests: verify all parsers emit ParseErrors for non-spending amounts.
 * Ensures consistency across CSV, XLSX, HTML, JSON, and OFX parsers (C39-TE02).
 */
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { parseGenericCSV } from '../src/csv/generic.js';
import { parseXLSX } from '../src/xlsx/index.js';
import { parseHTML } from '../src/html/index.js';
import { parseJSON } from '../src/json/index.js';
import { parseOFX } from '../src/ofx/index.js';
import * as XLSX from 'xlsx';

const TMP_DIR = join(import.meta.dir, '__tmp_parity');

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('non-spending amount ParseError parity (C39-TE02)', () => {
  const assertNonSpendingError = (errors: { message: string }[]) => {
    expect(errors.length).toBeGreaterThan(0);
    // Most parsers use "지출로 처리되지 않는 금액입니다" for zero/negative amounts.
    // OFX uses "입금/환불 내역은 지출로 처리되지 않습니다" for positive credits.
    expect(errors.some((e) =>
      e.message.includes('지출로 처리되지 않는 금액입니다') ||
      e.message.includes('입금/환불 내역은 지출로 처리되지 않습니다')
    )).toBe(true);
  };

  test('CSV generic parser emits ParseError for negative amounts', () => {
    const csv = `date,merchant,amount
2024-01-15,test,-5000
2024-01-16,normal,10000`;
    const result = parseGenericCSV(csv, null);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('CSV generic parser rejects composed negative amount markers', () => {
    const csv = `date,merchant,amount
2024-01-14,trailing,-1000-
2024-01-15,korean,마이너스－１０００
2024-01-16,normal,10000`;
    const result = parseGenericCSV(csv, null);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('CSV generic parser emits ParseError for zero amounts', () => {
    const csv = `date,merchant,amount
2024-01-15,test,0
2024-01-16,normal,10000`;
    const result = parseGenericCSV(csv, null);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('JSON parser emits ParseError for negative amounts', () => {
    const input = JSON.stringify([
      { date: '2024-01-15', merchant: 'refund', amount: -5000 },
      { date: '2024-01-16', merchant: 'normal', amount: 10000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('JSON parser rejects composed negative amount markers', () => {
    const input = JSON.stringify([
      { date: '2024-01-14', merchant: 'trailing', amount: '-1000-' },
      { date: '2024-01-15', merchant: 'korean', amount: '마이너스－１０００' },
      { date: '2024-01-16', merchant: 'normal', amount: 10000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('JSON parser emits ParseError for zero amounts', () => {
    const input = JSON.stringify([
      { date: '2024-01-15', merchant: 'balance', amount: 0 },
      { date: '2024-01-16', merchant: 'normal', amount: 10000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('OFX parser emits ParseError for positive amounts (credits)', () => {
    const content = `<OFX><CURDEF>KRW
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240115
<TRNAMT>5000.00
<NAME>REFUND
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240116
<TRNAMT>-10000.00
<NAME>SHOPPING
</STMTTRN>
</BANKTRANLIST>
</OFX>`;
    const result = parseOFX(content);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('HTML parser emits ParseError for negative amounts', () => {
    const html = `<table>
<tr><th>date</th><th>merchant</th><th>amount</th></tr>
<tr><td>2024-01-15</td><td>refund</td><td>-5000</td></tr>
<tr><td>2024-01-16</td><td>normal</td><td>10000</td></tr>
</table>`;
    const result = parseHTML(html);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('HTML parser emits ParseError for zero amounts', () => {
    const html = `<table>
<tr><th>date</th><th>merchant</th><th>amount</th></tr>
<tr><td>2024-01-15</td><td>balance</td><td>0</td></tr>
<tr><td>2024-01-16</td><td>normal</td><td>10000</td></tr>
</table>`;
    const result = parseHTML(html);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('XLSX parser emits ParseError for negative amounts', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['date', 'merchant', 'amount'],
      ['2024-01-15', 'refund', -5000],
      ['2024-01-16', 'normal', 10000],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filePath = join(TMP_DIR, 'negative.xlsx');
    writeFileSync(filePath, buf);
    const result = await parseXLSX(filePath, null);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });

  test('XLSX parser emits ParseError for zero amounts', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['date', 'merchant', 'amount'],
      ['2024-01-15', 'balance', 0],
      ['2024-01-16', 'normal', 10000],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filePath = join(TMP_DIR, 'zero.xlsx');
    writeFileSync(filePath, buf);
    const result = await parseXLSX(filePath, null);
    expect(result.transactions).toHaveLength(1);
    assertNonSpendingError(result.errors);
  });
});
