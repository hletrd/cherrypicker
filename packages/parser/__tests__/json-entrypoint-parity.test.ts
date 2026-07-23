import { describe, expect, test } from 'bun:test';
import { parseJSON as parseServerJSON } from '../src/json/index.js';
import { parseJSON as parseWebJSON } from '../../../apps/web/src/lib/parser/json.js';

function comparableResult(
  result: ReturnType<typeof parseServerJSON> | ReturnType<typeof parseWebJSON>,
) {
  return {
    transactions: result.transactions,
    errors: result.errors.map(({ message, code, line }) => ({
      message,
      code,
      line,
    })),
  };
}

describe('canonical JSON server/web entrypoint parity', () => {
  test.each([
    ['direct', (rows: unknown[]) => rows],
    ['wrapped', (rows: unknown[]) => ({ transactions: rows })],
  ])('%s arrays preserve row identity and rejection counts', (_label, wrap) => {
    const rows = [
      { date: '2026-07-01', merchant: '정상', amount: 10_000 },
      null,
      { merchant: '날짜 없음', amount: 20_000 },
      { date: '2026-07-04', merchant: '금액 없음' },
      { date: 'bad-date', merchant: '날짜 오류', amount: 30_000 },
      { date: '2026-07-06', merchant: '사실 경고', amount: 40_000, fuelVolumeLiters: 201 },
    ];
    const content = JSON.stringify(wrap(rows));
    const server = parseServerJSON(content);
    const web = parseWebJSON(content);

    expect(comparableResult(web)).toEqual(comparableResult(server));
    const rejected = server.errors.filter(
      (error) => error.code === 'json_row_rejected',
    );
    expect(server.transactions).toHaveLength(2);
    expect(rejected.map((error) => error.line)).toEqual([2, 3, 4, 5]);
    expect(server.transactions.length + rejected.length).toBe(rows.length);
    expect(
      server.errors.filter((error) => error.code === 'json_fact_invalid'),
    ).toHaveLength(1);
  });

  test.each([
    ['syntax', '[{"date":'],
    ['non-array object', '{"account":"test"}'],
    ['scalar', '"statement"'],
  ])('returns the same %s diagnostic', (_label, content) => {
    expect(comparableResult(parseWebJSON(content))).toEqual(
      comparableResult(parseServerJSON(content)),
    );
  });
});
