import { describe, expect, test } from 'bun:test';
import {
  cleanHTML,
  fetchCardPage,
} from '../src/fetcher.js';
import type {
  RequestHop,
  ScraperResponse,
} from '../src/fetcher.js';

const PUBLIC_RESOLVER = async () => [
  { address: '93.184.216.34', family: 4 as const },
];

function response(
  status: number,
  headers: Record<string, string>,
  chunks: Uint8Array[] = [],
  statusText = '',
): { value: ScraperResponse; cancelled: () => boolean } {
  let wasCancelled = false;
  const value: ScraperResponse = {
    status,
    statusText,
    headers,
    body: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
    cancel: () => {
      wasCancelled = true;
    },
  };
  return { value, cancelled: () => wasCancelled };
}

const utf8 = (value: string) => new TextEncoder().encode(value);

describe('cleanHTML', () => {
  test('keeps main content while stripping obvious chrome and scripts', () => {
    const html = `
      <html>
        <body>
          <header>header chrome</header>
          <main>
            <h1>주요 혜택</h1>
            <p>대중교통 10% 할인</p>
          </main>
          <script>window.__secret = 'x'</script>
          <footer>footer chrome</footer>
        </body>
      </html>
    `;

    const cleaned = cleanHTML(html);

    expect(cleaned).toContain('주요 혜택');
    expect(cleaned).toContain('대중교통 10% 할인');
    expect(cleaned).not.toContain('header chrome');
    expect(cleaned).not.toContain('footer chrome');
    expect(cleaned).not.toContain('__secret');
  });
});

describe('fetchCardPage security controls', () => {
  test('reads one bounded UTF-8 response and clears the operation timer', async () => {
    let calls = 0;
    let clears = 0;
    const fakeTimer = setTimeout(() => {}, 60_000);
    const requestHop: RequestHop = async () => {
      calls++;
      return response(
        200,
        { 'content-type': 'text/html; charset=utf-8' },
        [utf8('<html><body>카드 혜택</body></html>')],
      ).value;
    };

    const html = await fetchCardPage('https://card.example.com/product', {
      allowedHosts: ['card.example.com'],
      resolver: PUBLIC_RESOLVER,
      requestHop,
      setTimer: () => fakeTimer,
      clearTimer: (timer) => {
        clears++;
        clearTimeout(timer);
      },
    });

    expect(html).toContain('카드 혜택');
    expect(calls).toBe(1);
    expect(clears).toBe(1);
  });

  test('detects legacy charset metadata without a second request', async () => {
    let calls = 0;
    const requestHop: RequestHop = async () => {
      calls++;
      return response(
        200,
        { 'content-type': 'text/html' },
        [utf8('<meta charset="ks_c_5601-1987"><body>benefit</body>')],
      ).value;
    };

    const html = await fetchCardPage('https://card.example.com/product', {
      allowedHosts: ['card.example.com'],
      resolver: PUBLIC_RESOLVER,
      requestHop,
    });

    expect(html).toContain('benefit');
    expect(calls).toBe(1);
  });

  test('decodes EUC-KR and CP949 aliases from the same bounded bytes', async () => {
    const koreanBody = Uint8Array.from([
      ...utf8('<html><body>'),
      0xc7,
      0xd1,
      0xb1,
      0xdb,
      ...utf8('</body></html>'),
    ]);
    for (const charset of [
      'euc-kr',
      'cp949',
      'windows-949',
      'ks_c_5601-1987',
    ]) {
      let calls = 0;
      const html = await fetchCardPage('https://card.example.com/product', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => {
          calls++;
          return response(
            200,
            { 'content-type': `text/html; charset=${charset}` },
            [koreanBody],
          ).value;
        },
      });
      expect(html).toContain('한글');
      expect(calls).toBe(1);
    }
  });

  test('rejects first-hop policy violations before invoking the transport', async () => {
    let calls = 0;
    const requestHop: RequestHop = async () => {
      calls++;
      return response(200, { 'content-type': 'text/html' }).value;
    };

    await expect(
      fetchCardPage('http://127.0.0.1/admin', {
        allowedHosts: ['127.0.0.1'],
        requestHop,
      }),
    ).rejects.toThrow('공개 네트워크가 아닌');
    await expect(
      fetchCardPage('https://off-policy.example.test/', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop,
      }),
    ).rejects.toThrow('허용되지 않은');
    expect(calls).toBe(0);
  });

  test('revalidates an allowed relative redirect', async () => {
    const paths: string[] = [];
    const first = response(302, { location: '/final' });
    const second = response(
      200,
      { 'content-type': 'text/html; charset=utf-8' },
      [utf8('<html>done</html>')],
    );
    const requestHop: RequestHop = async (target) => {
      paths.push(target.url.pathname);
      return target.url.pathname === '/start' ? first.value : second.value;
    };

    await expect(
      fetchCardPage('https://card.example.com/start', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop,
      }),
    ).resolves.toContain('done');
    expect(paths).toEqual(['/start', '/final']);
    expect(first.cancelled()).toBe(true);
  });

  test('rejects redirect loops, missing locations, and a sixth redirect', async () => {
    let loopCalls = 0;
    const loop = response(302, { location: '/loop' });
    await expect(
      fetchCardPage('https://card.example.com/loop', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => {
          loopCalls++;
          return loop.value;
        },
      }),
    ).rejects.toThrow('순환');
    expect(loopCalls).toBe(1);
    expect(loop.cancelled()).toBe(true);

    const missing = response(302, {});
    await expect(
      fetchCardPage('https://card.example.com/start', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => missing.value,
      }),
    ).rejects.toThrow('Location');
    expect(missing.cancelled()).toBe(true);

    let redirectCalls = 0;
    await expect(
      fetchCardPage('https://card.example.com/start', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => {
          redirectCalls++;
          return response(302, { location: `/hop-${redirectCalls}` }).value;
        },
      }),
    ).rejects.toThrow('5회를 초과');
    expect(redirectCalls).toBe(6);
  });

  test('blocks a redirect to a private address before a second request', async () => {
    let calls = 0;
    const first = response(302, { location: 'http://internal.example/admin' });
    const requestHop: RequestHop = async () => {
      calls++;
      return first.value;
    };

    await expect(
      fetchCardPage('https://card.example.com/start', {
        allowedHosts: ['card.example.com', 'internal.example'],
        resolver: async (hostname) =>
          hostname === 'internal.example'
            ? [{ address: '10.0.0.2', family: 4 as const }]
            : [{ address: '93.184.216.34', family: 4 as const }],
        requestHop,
      }),
    ).rejects.toThrow('공개 네트워크가 아닌');
    expect(calls).toBe(1);
  });

  test('rejects non-success and non-HTML responses before reading', async () => {
    for (const value of [
      response(500, { 'content-type': 'text/html' }, [], 'Server Error'),
      response(200, { 'content-type': 'application/json' }, [utf8('{}')]),
      response(200, {}, [utf8('<html></html>')]),
      response(
        200,
        {
          'content-type': 'text/html',
          'content-encoding': 'gzip',
        },
        [utf8('<html></html>')],
      ),
    ]) {
      await expect(
        fetchCardPage('https://card.example.com/product', {
          allowedHosts: ['card.example.com'],
          resolver: PUBLIC_RESOLVER,
          requestHop: async () => value.value,
        }),
      ).rejects.toThrow();
      expect(value.cancelled()).toBe(true);
    }
  });

  test('rejects declared and streamed bodies above the byte cap', async () => {
    const declared = response(
      200,
      {
        'content-type': 'text/html',
        'content-length': '11',
      },
      [utf8('small')],
    );
    await expect(
      fetchCardPage('https://card.example.com/product', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => declared.value,
        maxResponseBytes: 10,
      }),
    ).rejects.toThrow('너무 큽니다');
    expect(declared.cancelled()).toBe(true);

    const streamed = response(
      200,
      { 'content-type': 'text/html' },
      [utf8('123456'), utf8('78901')],
    );
    await expect(
      fetchCardPage('https://card.example.com/product', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => streamed.value,
        maxResponseBytes: 10,
      }),
    ).rejects.toThrow('너무 큽니다');
    expect(streamed.cancelled()).toBe(true);

    const invalidLength = response(
      200,
      {
        'content-type': 'text/html',
        'content-length': 'not-a-number',
      },
      [utf8('small')],
    );
    await expect(
      fetchCardPage('https://card.example.com/product', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => invalidLength.value,
        maxResponseBytes: 10,
      }),
    ).rejects.toThrow('Content-Length');
    expect(invalidLength.cancelled()).toBe(true);
  });

  test('cancels a rejected body stream and clears the timer', async () => {
    let cancelled = false;
    let clears = 0;
    const fakeTimer = setTimeout(() => {}, 60_000);
    const failingResponse: ScraperResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' },
      body: (async function* () {
        yield utf8('<html>');
        throw new Error('stream failed');
      })(),
      cancel: () => {
        cancelled = true;
      },
    };

    await expect(
      fetchCardPage('https://card.example.com/product', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => failingResponse,
        setTimer: () => fakeTimer,
        clearTimer: (timer) => {
          clears++;
          clearTimeout(timer);
        },
      }),
    ).rejects.toThrow('stream failed');
    expect(cancelled).toBe(true);
    expect(clears).toBe(1);
  });

  test('enforces an already-expired operation deadline without a request', async () => {
    let calls = 0;
    let clears = 0;
    const fakeTimer = setTimeout(() => {}, 60_000);
    await expect(
      fetchCardPage('https://card.example.com/product', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => {
          calls++;
          return response(200, { 'content-type': 'text/html' }).value;
        },
        timeoutMs: 1,
        setTimer: (callback) => {
          callback();
          return fakeTimer;
        },
        clearTimer: (timer) => {
          clears++;
          clearTimeout(timer);
        },
      }),
    ).rejects.toThrow('시간이 1ms를 초과');
    expect(calls).toBe(0);
    expect(clears).toBe(1);
  });

  test('clears the timer when the transport rejects', async () => {
    let clears = 0;
    const fakeTimer = setTimeout(() => {}, 60_000);
    await expect(
      fetchCardPage('https://card.example.com/product', {
        allowedHosts: ['card.example.com'],
        resolver: PUBLIC_RESOLVER,
        requestHop: async () => {
          throw new Error('network failed');
        },
        setTimer: () => fakeTimer,
        clearTimer: (timer) => {
          clears++;
          clearTimeout(timer);
        },
      }),
    ).rejects.toThrow('network failed');
    expect(clears).toBe(1);
  });
});
