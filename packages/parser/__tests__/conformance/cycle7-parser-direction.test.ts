import { describe, expect, test } from 'bun:test';

import {
  AMBIGUOUS_AMOUNT_ERROR_CODE,
  compileAmountFieldPlan,
  NON_SPENDING_AMOUNT_ERROR_CODE,
  resolveAmountField,
} from '../../src/shared/amount-fields.js';
import { parseCSV as parseServerCSV } from '../../src/csv/index.js';
import { parseHTML as parseServerHTML } from '../../src/html/index.js';
import { parseJSON as parseServerJSON } from '../../src/json/index.js';
import { parseXLSXBuffer as parseServerXLSX } from '../../src/xlsx/index.js';
import { parseCSV as parseWebCSV } from '../../../../apps/web/src/lib/parser/csv.js';
import { parseHTML as parseWebHTML } from '../../../../apps/web/src/lib/parser/html.js';
import { parseJSON as parseWebJSON } from '../../../../apps/web/src/lib/parser/json.js';
import { parseXLSX as parseWebXLSX } from '../../../../apps/web/src/lib/parser/xlsx.js';
import { asArrayBuffer, createWorkbookFixture } from './workbook.js';

function comparable(result: {
  transactions: Array<{ merchant: string; amount: number }>;
  errors: Array<{ code?: string; count?: number }>;
}) {
  return {
    transactions: result.transactions.map(({ merchant, amount }) => ({
      merchant,
      amount,
    })),
    errors: result.errors.map(({ code, count }) => ({ code, count })),
  };
}

describe('Cycle 7 directional amount fields', () => {
  test.each([
    [
      ['date', 'merchant', 'Credit', 'Debit'],
      ['2026-07-01', 'Refund', '5000', ''],
      ['2026-07-02', 'Purchase', '', '-7000'],
    ],
    [
      ['date', 'merchant', 'Debit', 'Credit'],
      ['2026-07-01', 'Refund', '', '5000'],
      ['2026-07-02', 'Purchase', '-7000', ''],
    ],
  ])('resolves paired fields independently of header order', (
    headers,
    refundRow,
    purchaseRow,
  ) => {
    const plan = compileAmountFieldPlan(headers);
    expect(resolveAmountField(plan, (index) => refundRow[index])).toMatchObject({
      kind: 'non-spending',
      raw: '5000',
    });
    expect(resolveAmountField(plan, (index) => purchaseRow[index])).toMatchObject({
      kind: 'spending',
      raw: '-7000',
      role: 'outgoing',
    });
  });

  test.each([
    ['Credit,Debit', '5000,', ',-7000'],
    ['Debit,Credit', ',5000', '-7000,'],
  ])('server and browser CSV agree for %s order', (amountHeaders, refund, purchase) => {
    const content = [
      `date,merchant,${amountHeaders}`,
      `2026-07-01,Refund,${refund}`,
      `2026-07-02,Purchase,${purchase}`,
    ].join('\n');
    const server = parseServerCSV(content);
    const web = parseWebCSV(content);

    expect(comparable(web)).toEqual(comparable(server));
    expect(server.transactions).toEqual([
      expect.objectContaining({ merchant: 'Purchase', amount: 7000 }),
    ]);
    expect(server.errors.some(
      ({ code }) => code === NON_SPENDING_AMOUNT_ERROR_CODE,
    )).toBe(true);
  });

  test('credit-only CSV is diagnosed instead of rediscovered by numeric inference', () => {
    const content = [
      'date,merchant,credit',
      '2026-07-01,Refund,5000',
    ].join('\n');
    const result = parseServerCSV(content);

    expect(result.transactions).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: NON_SPENDING_AMOUNT_ERROR_CODE }),
    ]);
  });

  test('Korean refund and withdrawal columns retain only the withdrawal', () => {
    const content = [
      'date,merchant,환불금액,출금액',
      '2026-07-01,환불,5000,',
      '2026-07-02,구매,,7000',
    ].join('\n');
    const result = parseServerCSV(content);

    expect(result.transactions.map(({ merchant, amount }) => ({
      merchant,
      amount,
    }))).toEqual([{ merchant: '구매', amount: 7000 }]);
    expect(result.errors[0]?.code).toBe(NON_SPENDING_AMOUNT_ERROR_CODE);
  });

  test('combined incoming/outgoing header fails closed', () => {
    const result = parseServerCSV([
      'date,merchant,Debit/Credit',
      '2026-07-01,Unknown,5000',
    ].join('\n'));

    expect(result.transactions).toEqual([]);
    expect(result.errors[0]?.code).toBe(AMBIGUOUS_AMOUNT_ERROR_CODE);
  });

  test('neutral negative amounts remain non-spending', () => {
    const result = parseServerCSV([
      'date,merchant,amount',
      '2026-07-01,Refund,-7000',
    ].join('\n'));

    expect(result.transactions).toEqual([]);
    expect(result.errors[0]?.message).toContain('지출로 처리되지 않는 금액');
  });

  test.each([
    ['Credit', 'Debit'],
    ['Debit', 'Credit'],
  ])('server and browser XLSX agree for %s/%s order', (
    firstHeader,
    secondHeader,
  ) => {
    const creditFirst = firstHeader === 'Credit';
    const workbook = createWorkbookFixture([
      ['date', 'merchant', firstHeader, secondHeader],
      ['2026-07-01', 'Refund', creditFirst ? 5000 : '', creditFirst ? '' : 5000],
      ['2026-07-02', 'Purchase', creditFirst ? '' : -7000, creditFirst ? -7000 : ''],
    ]);
    const server = parseServerXLSX(workbook.bytes);
    const web = parseWebXLSX(asArrayBuffer(workbook.bytes));

    expect(comparable(web)).toEqual(comparable(server));
    expect(server.transactions).toEqual([
      expect.objectContaining({ merchant: 'Purchase', amount: 7000 }),
    ]);
    expect(server.errors[0]?.code).toBe(NON_SPENDING_AMOUNT_ERROR_CODE);
  });

  test('server and browser HTML tables use the same directional plan', () => {
    const content = `<table>
<tr><th>date</th><th>merchant</th><th>Credit</th><th>Debit</th></tr>
<tr><td>2026-07-01</td><td>Refund</td><td>5000</td><td></td></tr>
<tr><td>2026-07-02</td><td>Purchase</td><td></td><td>-7000</td></tr>
</table>`;
    const server = parseServerHTML(content);
    const web = parseWebHTML(content);

    expect(comparable(web)).toEqual(comparable(server));
    expect(server.transactions).toEqual([
      expect.objectContaining({ merchant: 'Purchase', amount: 7000 }),
    ]);
    expect(server.errors[0]?.code).toBe(NON_SPENDING_AMOUNT_ERROR_CODE);
  });

  test('shared JSON rejects credits and accepts debits independent of key order', () => {
    const input = JSON.stringify([
      { date: '2026-07-01', merchant: 'Refund', credit: 5000, debit: '' },
      { debit: -7000, credit: '', merchant: 'Purchase', date: '2026-07-02' },
    ]);
    const server = parseServerJSON(input);
    const web = parseWebJSON(input);

    expect(comparable(web)).toEqual(comparable(server));
    expect(server.transactions).toEqual([
      expect.objectContaining({ merchant: 'Purchase', amount: 7000 }),
    ]);
    expect(server.errors[0]?.code).toBe(NON_SPENDING_AMOUNT_ERROR_CODE);
  });

  test('shared JSON rejects conflicting populated directions', () => {
    const result = parseServerJSON(JSON.stringify([{
      date: '2026-07-01',
      merchant: 'Conflict',
      debit: 7000,
      credit: 5000,
    }]));

    expect(result.transactions).toEqual([]);
    expect(result.errors[0]?.code).toBe(AMBIGUOUS_AMOUNT_ERROR_CODE);
  });
});
