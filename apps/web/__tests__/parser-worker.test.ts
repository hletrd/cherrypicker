import { describe, expect, test } from 'bun:test';
import type { ParseResult } from '../src/lib/parser/types.js';
import {
  parseWithWorker,
  type ParserWorkerFactory,
  type ParserWorkerLike,
} from '../src/lib/parser/worker-runner.js';
import type {
  ParserWorkerRequest,
  ParserWorkerResponse,
} from '../src/lib/parser/worker-protocol.js';
import { MAX_UPLOAD_FILE_BYTES } from '../src/lib/upload-admission.js';

class FakeWorker implements ParserWorkerLike {
  messages: ParserWorkerRequest[] = [];
  transfers: Array<Transferable[] | undefined> = [];
  terminations = 0;
  messageListeners = new Set<
    (event: MessageEvent<ParserWorkerResponse>) => void
  >();
  errorListeners = new Set<(event: ErrorEvent) => void>();

  postMessage(
    message: ParserWorkerRequest,
    transfer?: Transferable[],
  ): void {
    this.messages.push(message);
    this.transfers.push(transfer);
  }

  addEventListener(
    type: 'message' | 'error',
    listener:
      | ((event: MessageEvent<ParserWorkerResponse>) => void)
      | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.add(
        listener as (event: MessageEvent<ParserWorkerResponse>) => void,
      );
    } else {
      this.errorListeners.add(listener as (event: ErrorEvent) => void);
    }
  }

  removeEventListener(
    type: 'message' | 'error',
    listener:
      | ((event: MessageEvent<ParserWorkerResponse>) => void)
      | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.delete(
        listener as (event: MessageEvent<ParserWorkerResponse>) => void,
      );
    } else {
      this.errorListeners.delete(listener as (event: ErrorEvent) => void);
    }
  }

  terminate(): void {
    this.terminations++;
  }

  respond(response: ParserWorkerResponse): void {
    for (const listener of this.messageListeners) {
      listener({ data: response } as MessageEvent<ParserWorkerResponse>);
    }
  }
}

class TransferringFakeWorker extends FakeWorker {
  override postMessage(
    message: ParserWorkerRequest,
    transfer?: Transferable[],
  ): void {
    this.messages.push(structuredClone(message, { transfer: transfer ?? [] }));
    this.transfers.push(transfer);
  }
}

describe('browser parser worker ownership', () => {
  test.each([
    ['csv', new ArrayBuffer(8)],
    ['xlsx', new ArrayBuffer(8)],
    ['json', new ArrayBuffer(8)],
    ['ofx', new ArrayBuffer(8)],
    ['html', new ArrayBuffer(8)],
  ] as const)('aborting active %s parsing terminates its worker', async (
    format,
    payload,
  ) => {
    const worker = new FakeWorker();
    const factory: ParserWorkerFactory = () => worker;
    const controller = new AbortController();
    const parsing = parseWithWorker(
      { format, payload },
      controller.signal,
      factory,
    );

    controller.abort();
    const error = await parsing.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(worker.terminations).toBe(1);
    expect(worker.messageListeners.size).toBe(0);
    expect(worker.errorListeners.size).toBe(0);
  });

  test.each(['csv', 'xlsx', 'json', 'ofx', 'html'] as const)(
    'rehydrates parser errors and transfers original %s buffers',
    async (format) => {
      const worker = new FakeWorker();
      const buffer = new ArrayBuffer(8);
      const parsing = parseWithWorker(
        { format, payload: buffer },
        undefined,
        () => worker,
      );
      const result: ParseResult = {
        bank: null,
        format,
        transactions: [],
        errors: [],
      };
      worker.respond({
        ok: true,
        result: {
          ...result,
          errors: [{ message: '날짜 오류', line: 3 }],
        },
      });

      const parsed = await parsing;
      expect(parsed.errors[0]).toMatchObject({
        name: 'ParseError',
        message: '날짜 오류',
        line: 3,
      });
      expect(worker.transfers[0]).toEqual([buffer]);
      expect(worker.messages[0]?.payload).toBe(buffer);
      expect(typeof worker.messages[0]?.payload).not.toBe('string');
      expect(worker.terminations).toBe(1);
    },
  );

  test('transfers two concurrent maximum-size text inputs before yielding', async () => {
    const jsonWorker = new TransferringFakeWorker();
    const htmlWorker = new TransferringFakeWorker();
    const jsonBuffer = new ArrayBuffer(MAX_UPLOAD_FILE_BYTES);
    const htmlBuffer = new ArrayBuffer(MAX_UPLOAD_FILE_BYTES);
    let heartbeat = false;
    queueMicrotask(() => {
      heartbeat = true;
    });

    const jsonParsing = parseWithWorker(
      { format: 'json', payload: jsonBuffer },
      undefined,
      () => jsonWorker,
    );
    const htmlParsing = parseWithWorker(
      { format: 'html', payload: htmlBuffer },
      undefined,
      () => htmlWorker,
    );

    expect(jsonBuffer.byteLength).toBe(0);
    expect(htmlBuffer.byteLength).toBe(0);
    expect(jsonWorker.messages[0]?.payload.byteLength).toBe(
      MAX_UPLOAD_FILE_BYTES,
    );
    expect(htmlWorker.messages[0]?.payload.byteLength).toBe(
      MAX_UPLOAD_FILE_BYTES,
    );
    await Promise.resolve();
    expect(heartbeat).toBe(true);

    jsonWorker.respond({
      ok: true,
      result: {
        bank: null,
        format: 'json',
        transactions: [],
        errors: [],
      },
    });
    htmlWorker.respond({
      ok: true,
      result: {
        bank: null,
        format: 'html',
        transactions: [],
        errors: [],
      },
    });
    await Promise.all([jsonParsing, htmlParsing]);
    expect(jsonWorker.terminations).toBe(1);
    expect(htmlWorker.terminations).toBe(1);
  });

  test('terminates the worker when startup fails', async () => {
    const worker = new FakeWorker();
    worker.postMessage = () => {
      throw new Error('clone failed');
    };

    const error = await parseWithWorker(
      { format: 'csv', payload: new ArrayBuffer(8) },
      undefined,
      () => worker,
    ).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ message: 'clone failed' });
    expect(worker.terminations).toBe(1);
    expect(worker.messageListeners.size).toBe(0);
    expect(worker.errorListeners.size).toBe(0);
  });

  test('rehydrates structured text-encoding worker failures', async () => {
    const worker = new FakeWorker();
    const parsing = parseWithWorker(
      { format: 'json', payload: new ArrayBuffer(8) },
      undefined,
      () => worker,
    );
    worker.respond({
      ok: false,
      message: 'JSON text encoding is unsupported: cp949.',
      name: 'UnsupportedTextEncodingError',
      code: 'UNSUPPORTED_TEXT_ENCODING',
      format: 'json',
      encoding: 'cp949',
    });

    const error = await parsing.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({
      name: 'UnsupportedTextEncodingError',
      code: 'UNSUPPORTED_TEXT_ENCODING',
      format: 'json',
      encoding: 'cp949',
    });
    expect(worker.terminations).toBe(1);
  });
});
