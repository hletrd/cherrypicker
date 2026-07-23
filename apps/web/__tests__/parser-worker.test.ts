import { describe, expect, test } from 'bun:test';
import type { ParseResult } from '../src/lib/parser/types.js';
import { ParseError } from '../src/lib/parser/types.js';
import {
  parseWithWorker,
  type ParserWorkerFactory,
  type ParserWorkerLike,
} from '../src/lib/parser/worker-runner.js';
import type {
  ParserWorkerRequest,
  ParserWorkerResponse,
} from '../src/lib/parser/worker-protocol.js';
import {
  MAX_SERIALIZED_PARSE_ERROR_MESSAGE_LENGTH,
  MAX_SERIALIZED_PARSE_ERROR_RAW_LENGTH,
  MAX_SERIALIZED_PARSE_ERRORS,
  serializeParserWorkerResult,
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
  messageErrorListeners = new Set<(event: MessageEvent<unknown>) => void>();

  postMessage(
    message: ParserWorkerRequest,
    transfer?: Transferable[],
  ): void {
    this.messages.push(message);
    this.transfers.push(transfer);
  }

  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | ((event: MessageEvent<ParserWorkerResponse>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent<unknown>) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.add(
        listener as (event: MessageEvent<ParserWorkerResponse>) => void,
      );
    } else if (type === 'error') {
      this.errorListeners.add(listener as (event: ErrorEvent) => void);
    } else {
      this.messageErrorListeners.add(
        listener as (event: MessageEvent<unknown>) => void,
      );
    }
  }

  removeEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | ((event: MessageEvent<ParserWorkerResponse>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent<unknown>) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.delete(
        listener as (event: MessageEvent<ParserWorkerResponse>) => void,
      );
    } else if (type === 'error') {
      this.errorListeners.delete(listener as (event: ErrorEvent) => void);
    } else {
      this.messageErrorListeners.delete(
        listener as (event: MessageEvent<unknown>) => void,
      );
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

  emitMessageError(): void {
    for (const listener of this.messageErrorListeners) {
      listener({
        data: { privatePayload: 'must not escape into the error' },
      } as MessageEvent<unknown>);
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
    expect(worker.messageErrorListeners.size).toBe(0);
  });

  test('messageerror rejects once and removes every terminal listener', async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    let resolutions = 0;
    let rejections = 0;
    const parsing = parseWithWorker(
      { format: 'json', payload: new ArrayBuffer(8) },
      controller.signal,
      () => worker,
    ).then(
      (value) => {
        resolutions++;
        return { kind: 'resolved' as const, value };
      },
      (reason: unknown) => {
        rejections++;
        return { kind: 'rejected' as const, reason };
      },
    );

    worker.emitMessageError();
    worker.respond({
      ok: true,
      result: {
        bank: null,
        format: 'json',
        transactions: [],
        errors: [],
      },
    });
    controller.abort();

    const outcome = await parsing;
    expect(outcome).toMatchObject({
      kind: 'rejected',
      reason: { message: '파서 작업자 응답을 읽을 수 없어요.' },
    });
    expect(resolutions).toBe(0);
    expect(rejections).toBe(1);
    expect(worker.terminations).toBe(1);
    expect(worker.messageListeners.size).toBe(0);
    expect(worker.errorListeners.size).toBe(0);
    expect(worker.messageErrorListeners.size).toBe(0);
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
          errors: [{ message: '날짜 오류', line: 3, count: 4 }],
        },
      });

      const parsed = await parsing;
      expect(parsed.errors[0]).toMatchObject({
        name: 'ParseError',
        message: '날짜 오류',
        line: 3,
        count: 4,
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
    expect(worker.messageErrorListeners.size).toBe(0);
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

  test('bounds serialized parser diagnostics and preserves exact counts', () => {
    const errors = Array.from({ length: 250 }, (_, index) =>
      new ParseError(`경고-${index}-${'가'.repeat(2_000)}`, {
        raw: '나'.repeat(3_000),
        count: index === 249 ? 3 : undefined,
      }));
    const serialized = serializeParserWorkerResult({
      bank: null,
      format: 'json',
      transactions: [],
      errors,
    });

    expect(serialized.errors).toHaveLength(MAX_SERIALIZED_PARSE_ERRORS);
    expect(serialized.errors.at(-1)).toMatchObject({
      code: 'parse_diagnostics_omitted',
      count: 153,
    });
    expect(
      serialized.errors.reduce(
        (total, error) => total + (error.count ?? 1),
        0,
      ),
    ).toBe(252);
    expect(serialized.errors[0]?.message.length).toBeLessThanOrEqual(
      MAX_SERIALIZED_PARSE_ERROR_MESSAGE_LENGTH,
    );
    expect(serialized.errors[0]?.raw?.length).toBeLessThanOrEqual(
      MAX_SERIALIZED_PARSE_ERROR_RAW_LENGTH,
    );
  });

  test('summarizes the exact 101-error boundary before reading omitted payloads', () => {
    const errors = Array.from(
      { length: MAX_SERIALIZED_PARSE_ERRORS - 1 },
      (_, index) => new ParseError(`경고-${index}`),
    );
    for (let index = 0; index < 2; index++) {
      const omitted = { count: undefined } as unknown as ParseError;
      Object.defineProperty(omitted, 'message', {
        get(): never {
          throw new Error('omitted diagnostic payload was serialized');
        },
      });
      errors.push(omitted);
    }

    const serialized = serializeParserWorkerResult({
      bank: null,
      format: 'json',
      transactions: [],
      errors,
    });

    expect(serialized.errors).toHaveLength(MAX_SERIALIZED_PARSE_ERRORS);
    expect(serialized.errors.at(-1)).toMatchObject({
      code: 'parse_diagnostics_omitted',
      count: 2,
    });
    expect(
      serialized.errors.reduce(
        (total, error) => total + (error.count ?? 1),
        0,
      ),
    ).toBe(MAX_SERIALIZED_PARSE_ERRORS + 1);
  });
});
