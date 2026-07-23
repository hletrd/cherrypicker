import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { analyzeMultipleFiles } from '../src/lib/analyzer.js';
import { resetCardArtifactCachesForTests } from '../src/lib/cards.js';

const originalFetch = globalThis.fetch;

function setCategoryFetch(): void {
  const handler = async (input: RequestInfo | URL): Promise<Response> => {
    const pathname = new URL(String(input), 'https://example.test').pathname;
    if (!pathname.endsWith('/data/categories.json')) {
      throw new Error(`Unexpected request: ${pathname}`);
    }
    return Response.json({
      sourceHash: 'a'.repeat(64),
      categories: [{
        id: 'uncategorized',
        label: '미분류',
        labelKo: '미분류',
        keywords: [],
      }],
    });
  };
  globalThis.fetch = Object.assign(handler, {
    preconnect: originalFetch.preconnect?.bind(originalFetch) ?? (() => {}),
  });
}

beforeEach(() => {
  resetCardArtifactCachesForTests();
  setCategoryFetch();
});

afterAll(() => {
  resetCardArtifactCachesForTests();
  globalThis.fetch = originalFetch;
});

describe('multi-file zero-row diagnostics', () => {
  test('surfaces the parser diagnostic with file identity', async () => {
    const analysis = analyzeMultipleFiles([
      new File(
        [JSON.stringify([
          {
            date: 'not-a-date',
            merchant: '테스트',
            amount: 10_000,
          },
        ])],
        'bad-date.json',
        { type: 'application/json' },
      ),
    ]);
    const error = await analysis.then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('bad-date.json');
    expect((error as Error).message).toContain(
      '날짜를 해석할 수 없습니다: not-a-date',
    );
  });
});
