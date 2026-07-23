const { expect, test } = require('@playwright/test');

const homeUrl =
  process.env.PLAYWRIGHT_BASE_URL ??
  'http://127.0.0.1:4173/cherrypicker/';
const maximumUploadBytes = 10 * 1024 * 1024;

function maximumSizeCsv(merchant) {
  const statement = Buffer.from(
    [
      '날짜,가맹점,금액',
      `2026-07-01,${merchant},10000`,
      '',
    ].join('\n'),
    'utf8',
  );
  if (statement.byteLength > maximumUploadBytes) {
    throw new Error('The responsiveness fixture exceeds the upload ceiling.');
  }
  return Buffer.concat([
    statement,
    Buffer.alloc(maximumUploadBytes - statement.byteLength, 0x20),
  ]);
}

test('production parser workers keep the main thread ready while two maximum-size text files parse', async ({
  page,
}) => {
  test.setTimeout(120_000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    const NativeWorker = globalThis.Worker;
    const parserFormats = new Set(['csv', 'xlsx', 'json', 'ofx', 'html']);
    const probe = {
      starts: [],
      completions: 0,
      activeParserWorkers: 0,
      maximumActiveParserWorkers: 0,
      heartbeatSignals: 0,
      heartbeatWhileBothActive: 0,
      heartbeatSnapshot: null,
    };
    const heartbeatChannel = new MessageChannel();
    let heartbeatQueued = false;

    heartbeatChannel.port1.onmessage = () => {
      heartbeatQueued = false;
      probe.heartbeatSignals += 1;
      if (probe.activeParserWorkers >= 2) {
        probe.heartbeatWhileBothActive += 1;
        probe.heartbeatSnapshot ??= {
          activeParserWorkers: probe.activeParserWorkers,
          completions: probe.completions,
          startedWorkers: probe.starts.length,
          signaledAt: performance.now(),
        };
      }
    };

    const queueHeartbeat = () => {
      if (heartbeatQueued) return;
      heartbeatQueued = true;
      heartbeatChannel.port2.postMessage('ready');
    };

    class ProbedWorker extends NativeWorker {
      constructor(scriptURL, options) {
        super(scriptURL, options);
        this.__parserProbeActive = false;
        this.__parserProbeSettled = false;
        this.__parserProbeWorkerName = options?.name ?? null;
        this.__settleParserProbe = () => {
          if (
            !this.__parserProbeActive ||
            this.__parserProbeSettled
          ) {
            return;
          }
          this.__parserProbeSettled = true;
          probe.activeParserWorkers -= 1;
          probe.completions += 1;
        };
        super.addEventListener('message', this.__settleParserProbe);
        super.addEventListener('error', this.__settleParserProbe);
      }

      postMessage(message, transferOrOptions) {
        const parserRequest =
          message &&
          typeof message === 'object' &&
          parserFormats.has(message.format) &&
          message.payload instanceof ArrayBuffer;
        const transferList = Array.isArray(transferOrOptions)
          ? transferOrOptions
          : transferOrOptions?.transfer;
        const start = parserRequest && !this.__parserProbeActive
          ? {
              format: message.format,
              payloadBytes: message.payload.byteLength,
              transferred:
                Array.isArray(transferList) &&
                transferList.includes(message.payload),
              workerName: this.__parserProbeWorkerName,
            }
          : null;

        const result = super.postMessage(message, transferOrOptions);
        if (start) {
          this.__parserProbeActive = true;
          probe.starts.push(start);
          probe.activeParserWorkers += 1;
          probe.maximumActiveParserWorkers = Math.max(
            probe.maximumActiveParserWorkers,
            probe.activeParserWorkers,
          );
          if (probe.activeParserWorkers >= 2) queueHeartbeat();
        }
        return result;
      }

      terminate() {
        this.__settleParserProbe();
        return super.terminate();
      }
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      writable: true,
      value: ProbedWorker,
    });
    Object.defineProperty(globalThis, '__parserWorkerHeartbeatProbe', {
      configurable: false,
      value: probe,
    });
  });

  await page.goto(homeUrl);
  await page.waitForFunction(() =>
    Boolean(document.querySelector('astro-island:not([ssr])')),
  );

  const files = [
    {
      name: 'maximum-worker-a.csv',
      mimeType: 'text/csv',
      buffer: maximumSizeCsv('worker-heartbeat-a'),
    },
    {
      name: 'maximum-worker-b.csv',
      mimeType: 'text/csv',
      buffer: maximumSizeCsv('worker-heartbeat-b'),
    },
  ];
  expect(files.map(({ buffer }) => buffer.byteLength)).toEqual([
    maximumUploadBytes,
    maximumUploadBytes,
  ]);

  await page.getByLabel('파일 선택', { exact: true }).setInputFiles(files);
  await expect(page.getByText('maximum-worker-a.csv')).toBeVisible();
  await expect(page.getByText('maximum-worker-b.csv')).toBeVisible();
  await page
    .getByRole('button', { name: '분석 시작 (2개 파일)' })
    .click();

  await page.waitForFunction(
    () =>
      globalThis.__parserWorkerHeartbeatProbe?.heartbeatSnapshot !== null,
    undefined,
    { timeout: 60_000 },
  );

  const heartbeatProof = await page.evaluate(
    () => globalThis.__parserWorkerHeartbeatProbe,
  );
  expect(heartbeatProof.starts).toHaveLength(2);
  expect(heartbeatProof.starts).toEqual([
    {
      format: 'csv',
      payloadBytes: maximumUploadBytes,
      transferred: true,
      workerName: 'cherrypicker-csv-parser',
    },
    {
      format: 'csv',
      payloadBytes: maximumUploadBytes,
      transferred: true,
      workerName: 'cherrypicker-csv-parser',
    },
  ]);
  expect(heartbeatProof.maximumActiveParserWorkers).toBe(2);
  expect(heartbeatProof.heartbeatWhileBothActive).toBeGreaterThanOrEqual(1);
  expect(heartbeatProof.heartbeatSnapshot).toMatchObject({
    activeParserWorkers: 2,
    completions: 0,
    startedWorkers: 2,
  });

  await expect(page.getByText(/^분석 완료/)).toBeVisible({
    timeout: 60_000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => globalThis.__parserWorkerHeartbeatProbe?.completions,
        ),
      { timeout: 10_000 },
    )
    .toBe(2);
  expect(pageErrors).toEqual([]);
});
