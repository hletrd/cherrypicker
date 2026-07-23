import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardRuleSet } from '@cherrypicker/rules';
import {
  getAllCardRules,
  getCardById,
  getCardList,
  getCardSummaryById,
  loadCardSummaries,
  loadCategories,
  loadOptimizerCatalog,
  readCardsSummaryArtifact,
  resetCardArtifactCachesForTests,
} from '../src/lib/cards.js';
import type { CardsSummaryArtifact } from '../src/lib/cards.js';
import {
  readCardDetailShard,
  readOptimizerCatalog,
} from '../src/lib/card-catalog-reader.js';

const originalFetch = globalThis.fetch;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const shinhanRule: CardRuleSet = {
  card: {
    id: 'shinhan-test-card',
    issuer: 'shinhan',
    name: 'Shinhan Test',
    nameKo: '신한 테스트',
    type: 'credit',
    annualFee: { domestic: 10_000, international: 12_000 },
    url: 'https://www.shinhancard.com/test',
    lastUpdated: '2026-07-23',
    source: 'manual',
  },
  performanceTiers: [
    { id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null },
  ],
  performanceExclusions: [],
  rewards: [
    {
      id: 'base-reward',
      category: 'dining',
      type: 'discount',
      tiers: [
        {
          performanceTier: 'tier0',
          rate: 1,
          fixedAmount: null,
          unit: null,
          value: { kind: 'percentage', amount: 1 },
          monthlyCap: null,
          perTransactionCap: null,
          annualCap: null,
        },
      ],
      priority: 0,
      combination: 'exclusive',
      stackingGroup: 'base-reward',
      capGroup: 'base-reward',
      support: { status: 'supported' },
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

const kbRule: CardRuleSet = {
  ...shinhanRule,
  card: {
    ...shinhanRule.card,
    id: 'kb-test-card',
    issuer: 'kb',
    name: 'KB Test',
    nameKo: 'KB 테스트',
    url: 'https://card.kbcard.com/test',
  },
};

function summaryArtifact(): CardsSummaryArtifact {
  return {
    meta: {
      version: '1.0.0',
      generatedAt: '2026-07-23T00:00:00.000Z',
      totalIssuers: 2,
      totalCards: 2,
    },
    issuers: [
      {
        id: 'shinhan',
        nameKo: '신한카드',
        nameEn: 'Shinhan Card',
        website: 'https://www.shinhancard.com',
        cardCount: 1,
      },
      {
        id: 'kb',
        nameKo: 'KB국민카드',
        nameEn: 'KB Kookmin Card',
        website: 'https://card.kbcard.com',
        cardCount: 1,
      },
    ],
    cards: [
      {
        id: 'shinhan-test-card',
        issuer: 'shinhan',
        name: 'Shinhan Test',
        nameKo: '신한 테스트',
        type: 'credit',
        annualFee: { domestic: 10_000, international: 12_000 },
        rewardCategories: ['dining'],
      },
      {
        id: 'kb-test-card',
        issuer: 'kb',
        name: 'KB Test',
        nameKo: 'KB 테스트',
        type: 'credit',
        annualFee: { domestic: 10_000, international: 12_000 },
        rewardCategories: ['dining'],
      },
    ],
  };
}

function detailShard(rule: CardRuleSet) {
  const issuer = rule.card.issuer;
  return {
    issuer: {
      id: issuer,
      nameKo: issuer === 'shinhan' ? '신한카드' : 'KB국민카드',
      nameEn: issuer === 'shinhan' ? 'Shinhan Card' : 'KB Kookmin Card',
      website: issuer === 'shinhan'
        ? 'https://www.shinhancard.com'
        : 'https://card.kbcard.com',
      cardCount: 1,
    },
    cards: [rule],
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fetchCountEnding(
  counts: ReadonlyMap<string, number>,
  suffix: string,
): number | undefined {
  return [...counts].find(([path]) => path.endsWith(suffix))?.[1];
}

function setFetchMock(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): void {
  const preconnect: typeof fetch.preconnect =
    typeof originalFetch.preconnect === 'function'
      ? originalFetch.preconnect.bind(originalFetch)
      : () => {};
  const mock: typeof fetch = Object.assign(handler, {
    preconnect,
  });
  globalThis.fetch = mock;
}

async function getRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('Expected an Error rejection');
  }
  throw new Error('Expected promise to reject');
}

beforeEach(() => {
  resetCardArtifactCachesForTests();
});

afterAll(() => {
  resetCardArtifactCachesForTests();
  globalThis.fetch = originalFetch;
});

describe('generated catalog readers', () => {
  test('accepts every tracked browser catalog artifact with production readers', async () => {
    const dataDir = resolve(repoRoot, 'apps/web/public/data');
    const summary = readCardsSummaryArtifact(
      JSON.parse(await readFile(resolve(dataDir, 'cards-summary.json'), 'utf8')),
    );
    const optimizer = readOptimizerCatalog(
      JSON.parse(await readFile(resolve(dataDir, 'cards-optimizer.json'), 'utf8')),
    );
    const shardNames = (await readdir(resolve(dataDir, 'card-details')))
      .filter((name) => name.endsWith('.json'))
      .sort();
    const detailIds = new Set<string>();
    let detailCount = 0;

    for (const issuer of summary.issuers) {
      const shard = readCardDetailShard(
        JSON.parse(
          await readFile(
            resolve(dataDir, 'card-details', `${issuer.id}.json`),
            'utf8',
          ),
        ),
        issuer.id,
      );
      detailCount += shard.cards.length;
      for (const card of shard.cards) detailIds.add(card.card.id);
    }

    expect(shardNames).toHaveLength(summary.meta.totalIssuers);
    expect(optimizer).toHaveLength(summary.meta.totalCards);
    expect(detailCount).toBe(summary.meta.totalCards);
    expect(detailIds).toEqual(new Set(optimizer.map((card) => card.card.id)));
  });

  test('returns the original optimizer object graph after canonical validation', () => {
    const input = [shinhanRule];
    const result = readOptimizerCatalog(input);

    expect(result).toBe(input);
    expect(result[0]).toBe(input[0]);
  });

  test('returns original summary and detail artifacts after validation', () => {
    const summary = summaryArtifact();
    const shard = detailShard(shinhanRule);

    expect(readCardsSummaryArtifact(summary)).toBe(summary);
    expect(readCardDetailShard(shard, 'shinhan')).toBe(shard);
  });

  test('rejects malformed optimizer rules and cross-issuer detail shards', () => {
    expect(() => readOptimizerCatalog([{ card: { id: 'broken' } }])).toThrow(
      '카드 혜택 데이터[0]',
    );
    expect(() =>
      readCardDetailShard(detailShard(shinhanRule), 'kb'),
    ).toThrow('카드사 정보가 일치');
  });
});

describe('independent catalog loaders', () => {
  test('times out every shared waiter, cleans up, and retries the summary request', async () => {
    const nativeSetTimeout = globalThis.setTimeout;
    const nativeClearTimeout = globalThis.clearTimeout;
    const timeoutHandles = new Set<unknown>();
    const clearedTimeoutHandles = new Set<unknown>();
    let fetchCalls = 0;
    let sharedSignal: AbortSignal | undefined;
    let listenerAdds = 0;
    let listenerRemoves = 0;

    function trackedCallerSignal(): AbortSignal {
      const signal = new AbortController().signal;
      const nativeAdd = signal.addEventListener.bind(signal);
      const nativeRemove = signal.removeEventListener.bind(signal);
      Object.defineProperties(signal, {
        addEventListener: {
          value: (...args: Parameters<AbortSignal['addEventListener']>) => {
            if (args[0] === 'abort') listenerAdds += 1;
            return nativeAdd(...args);
          },
        },
        removeEventListener: {
          value: (...args: Parameters<AbortSignal['removeEventListener']>) => {
            if (args[0] === 'abort') listenerRemoves += 1;
            return nativeRemove(...args);
          },
        },
      });
      return signal;
    }

    setFetchMock((_: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls += 1;
      if (fetchCalls > 1) return Promise.resolve(jsonResponse(summaryArtifact()));

      sharedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_, reject) => {
        sharedSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted', 'AbortError')),
          { once: true },
        );
      });
    });

    // Exercise the production 10-second timeout without waiting in wall-clock
    // time, while retaining every other timer's native behavior.
    globalThis.setTimeout = ((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      const handle = nativeSetTimeout(
        handler,
        delay === 10_000 ? 0 : delay,
        ...args,
      );
      if (delay === 10_000) timeoutHandles.add(handle);
      return handle;
    }) as typeof globalThis.setTimeout;
    globalThis.clearTimeout = ((
      handle?: Parameters<typeof globalThis.clearTimeout>[0],
    ) => {
      if (handle !== undefined && timeoutHandles.has(handle)) {
        clearedTimeoutHandles.add(handle);
      }
      nativeClearTimeout(handle);
    }) as typeof globalThis.clearTimeout;

    try {
      const waiterA = loadCardSummaries(trackedCallerSignal());
      const waiterB = loadCardSummaries(trackedCallerSignal());
      const [errorA, errorB] = await Promise.all([
        getRejection(waiterA),
        getRejection(waiterB),
      ]);

      expect(errorA.message).toContain('요청 시간이 초과');
      expect(errorB.message).toContain('요청 시간이 초과');
      expect(sharedSignal?.aborted).toBe(true);
      expect(listenerAdds).toBe(2);
      expect(listenerRemoves).toBe(2);
      expect(timeoutHandles).toHaveLength(1);
      expect(clearedTimeoutHandles).toEqual(timeoutHandles);

      expect(await loadCardSummaries()).toHaveLength(2);
      expect(fetchCalls).toBe(2);
      expect(timeoutHandles).toHaveLength(2);
      expect(clearedTimeoutHandles).toEqual(timeoutHandles);
    } finally {
      globalThis.setTimeout = nativeSetTimeout;
      globalThis.clearTimeout = nativeClearTimeout;
    }
  });

  test('isolates one summary caller cancellation from the shared request', async () => {
    let resolveFetch!: (response: Response) => void;
    let fetchCalls = 0;
    let sharedSignal: AbortSignal | undefined;
    setFetchMock((_: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls += 1;
      sharedSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });

    const callerController = new AbortController();
    const cancelledCaller = loadCardSummaries(callerController.signal);
    const survivingCaller = loadCardSummaries();
    callerController.abort();

    const cancellation = await getRejection(cancelledCaller);
    expect(cancellation.name).toBe('AbortError');
    expect(sharedSignal?.aborted).toBe(false);

    resolveFetch(jsonResponse(summaryArtifact()));
    expect(await survivingCaller).toHaveLength(2);
    expect(fetchCalls).toBe(1);
  });

  test('retries only the failed optimizer cache and retains other artifacts', async () => {
    const fetchCounts = new Map<string, number>();
    setFetchMock(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), 'https://example.test').pathname;
      fetchCounts.set(path, (fetchCounts.get(path) ?? 0) + 1);
      if (path.endsWith('/cards-summary.json')) {
        return jsonResponse(summaryArtifact());
      }
      if (path.endsWith('/categories.json')) {
        return jsonResponse({
          categories: [
            {
              id: 'dining',
              label: '외식',
              labelKo: '외식',
              keywords: ['식당'],
            },
          ],
        });
      }
      if (path.endsWith('/cards-optimizer.json')) {
        const count = fetchCounts.get(path)!;
        return count === 1
          ? jsonResponse({ error: 'temporary' }, 503)
          : jsonResponse([shinhanRule, kbRule]);
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const summaries = await getCardList();
    const categories = await loadCategories();
    const firstOptimizerError = await getRejection(loadOptimizerCatalog());

    expect(firstOptimizerError.message).toContain('카드 혜택 데이터');
    expect(await getCardList()).toBe(summaries);
    expect(await loadCategories()).toBe(categories);

    const optimizer = await loadOptimizerCatalog();
    expect(await getAllCardRules()).toBe(optimizer);
    expect(fetchCountEnding(fetchCounts, '/data/cards-summary.json')).toBe(1);
    expect(fetchCountEnding(fetchCounts, '/data/categories.json')).toBe(1);
    expect(fetchCountEnding(fetchCounts, '/data/cards-optimizer.json')).toBe(2);
  });

  test('keeps issuer shard caches independent and retries only a failed shard', async () => {
    const fetchCounts = new Map<string, number>();
    setFetchMock(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), 'https://example.test').pathname;
      fetchCounts.set(path, (fetchCounts.get(path) ?? 0) + 1);
      if (path.endsWith('/cards-summary.json')) {
        return jsonResponse(summaryArtifact());
      }
      if (path.endsWith('/card-details/shinhan.json')) {
        return fetchCounts.get(path) === 1
          ? jsonResponse({ error: 'temporary' }, 503)
          : jsonResponse(detailShard(shinhanRule));
      }
      if (path.endsWith('/card-details/kb.json')) {
        return jsonResponse(detailShard(kbRule));
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    expect(
      (await getRejection(getCardById('shinhan-test-card'))).message,
    ).toContain('카드 상세 데이터');

    const kb = await getCardById('kb-test-card');
    const shinhan = await getCardById('shinhan-test-card');
    expect(kb?.nameKo).toBe('KB 테스트');
    expect(shinhan?.nameKo).toBe('신한 테스트');
    expect(await getCardById('kb-test-card')).toEqual(kb);
    expect(await getCardSummaryById('shinhan-test-card')).toMatchObject({
      issuerNameKo: '신한카드',
      rewardCategories: ['dining'],
    });

    expect(fetchCountEnding(fetchCounts, '/data/cards-summary.json')).toBe(1);
    expect(fetchCountEnding(fetchCounts, '/data/card-details/shinhan.json')).toBe(2);
    expect(fetchCountEnding(fetchCounts, '/data/card-details/kb.json')).toBe(1);
  });

  test('evicts malformed summary data so a later call can retry', async () => {
    let calls = 0;
    setFetchMock(async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({ meta: { totalCards: 0 }, issuers: [], cards: [] })
        : jsonResponse(summaryArtifact());
    });

    expect(
      (await getRejection(loadCardSummaries())).message,
    ).toContain('카드 목록 데이터');
    expect(await loadCardSummaries()).toHaveLength(2);
    expect(calls).toBe(2);
  });
});
