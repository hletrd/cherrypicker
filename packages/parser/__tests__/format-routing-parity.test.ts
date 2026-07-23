import { describe, expect, test } from 'bun:test';
import { parseFile } from '../../../apps/web/src/lib/parser/index.js';
import { parseStatement } from '../src/statement.js';

function bytes(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

async function parseServer(fileName: string, content: string) {
  const payload = bytes(content);
  return parseStatement(fileName, undefined, {
    readFile: async () => payload,
    readPrefix: async (_path, maxBytes) => payload.subarray(0, maxBytes),
  });
}

function browserFile(
  fileName: string,
  content: string,
  forbidText = false,
): File {
  const file = new File([content], fileName);
  if (forbidText) {
    Object.defineProperty(file, 'text', {
      value: async () => {
        throw new Error('window-side File.text() must not be used');
      },
    });
  }
  return file;
}

describe('browser/server statement routing parity', () => {
  const longJSON = JSON.stringify([{
    date: '2026-07-23',
    merchant: `테스트-${'가'.repeat(3_000)}`,
    amount: 10_000,
  }]);

  test.each([
    'statement.csv',
    'statement.tsv',
    'statement.txt',
    'statement.data',
  ])('keeps complete valid JSON as JSON under %s', async (fileName) => {
    expect(bytes(longJSON).byteLength).toBeGreaterThan(2_048);

    const [browser, server] = await Promise.all([
      parseFile(browserFile(fileName, longJSON)),
      parseServer(fileName, longJSON),
    ]);

    expect(browser.format).toBe('json');
    expect(server.format).toBe('json');
    expect(browser.transactions).toHaveLength(1);
    expect(server.transactions).toEqual(browser.transactions);
  });

  test.each([
    [
      'statement.csv',
      `{statement metadata
이용일,이용처,이용금액
2026-07-23,테스트 식당,10000`,
    ],
    [
      'statement.tsv',
      `{statement metadata
이용일\t이용처\t이용금액
2026-07-23\t테스트 식당\t10000`,
    ],
  ])('falls back from an invalid JSON prefix to delimited parsing for %s', async (
    fileName,
    content,
  ) => {
    const [browser, server] = await Promise.all([
      parseFile(browserFile(fileName, content)),
      parseServer(fileName, content),
    ]);

    expect(browser.format).toBe('csv');
    expect(server.format).toBe('csv');
    expect(browser.transactions).toHaveLength(1);
    expect(server.transactions).toEqual(browser.transactions);
  });

  test('keeps malformed unknown-extension JSON on the JSON syntax path', async () => {
    const content = '[{"date":"2026-07-23"';
    const [browser, server] = await Promise.all([
      parseFile(browserFile('statement.data', content)),
      parseServer('statement.data', content),
    ]);

    expect(browser.format).toBe('json');
    expect(server.format).toBe('json');
    expect(browser.transactions).toEqual([]);
    expect(server.transactions).toEqual([]);
    expect(browser.errors[0]?.code).toBe('json_syntax');
    expect(server.errors[0]?.code).toBe('json_syntax');
  });
});

describe('browser local text-parser buffer fallback', () => {
  test.each([
    [
      'statement.json',
      JSON.stringify([{
        date: '2026-07-23',
        merchant: 'JSON 식당',
        amount: 10_000,
      }]),
      'json',
    ],
    [
      'statement.ofx',
      `<OFX><CURDEF>KRW<BANKTRANLIST><STMTTRN>
<DTPOSTED>20260723
<TRNAMT>-10000
<NAME>OFX 식당
</STMTTRN></BANKTRANLIST></OFX>`,
      'ofx',
    ],
    [
      'statement.html',
      `<table>
<tr><th>이용일</th><th>이용처</th><th>이용금액</th></tr>
<tr><td>2026-07-23</td><td>HTML 식당</td><td>10000</td></tr>
</table>`,
      'html',
    ],
  ] as const)('decodes %s from ArrayBuffer without File.text()', async (
    fileName,
    content,
    format,
  ) => {
    const result = await parseFile(browserFile(fileName, content, true));

    expect(result.format).toBe(format);
    expect(result.transactions).toHaveLength(1);
  });
});
