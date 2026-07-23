import { describe, expect, test } from 'bun:test';
import { parseJSON as parseServerJSON } from '../src/json/index.js';
import { MAX_JSON_PARSE_DIAGNOSTICS } from '../src/shared/json.js';
import { parseJSON as parseWebJSON } from '../../../apps/web/src/lib/parser/json.js';

function comparableResult(
  result: ReturnType<typeof parseServerJSON> | ReturnType<typeof parseWebJSON>,
) {
  return {
    transactions: result.transactions,
    errors: result.errors.map(({ message, code, line, count }) => ({
      message,
      code,
      line,
      count,
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

  test('bounds large rejected-row diagnostics with an exact counted summary', () => {
    const rejectedRowCount = 20_000;
    const rows = [
      ...Array.from({ length: rejectedRowCount }, () => null),
      { date: '2026-07-01', merchant: '정상', amount: 10_000 },
    ];
    const content = JSON.stringify(rows);
    const server = parseServerJSON(content);
    const web = parseWebJSON(content);

    expect(comparableResult(web)).toEqual(comparableResult(server));
    expect(server.transactions).toHaveLength(1);
    expect(server.errors).toHaveLength(MAX_JSON_PARSE_DIAGNOSTICS);
    expect(
      server.errors.reduce(
        (total, error) => total + (error.count ?? 1),
        0,
      ),
    ).toBe(rejectedRowCount);
    expect(server.errors.at(-1)).toMatchObject({
      code: 'json_diagnostics_omitted',
      count: rejectedRowCount - (MAX_JSON_PARSE_DIAGNOSTICS - 1),
    });
    expect(new TextEncoder().encode(JSON.stringify(
      server.errors.map(({ message, code, line, count }) => ({
        message,
        code,
        line,
        count,
      })),
    )).byteLength).toBeLessThan(32_000);
  });
});
