import type { BankId, ParseResult } from './types.js';
import { ParseError } from './types.js';

export type ParserWorkerFormat = 'csv' | 'xlsx' | 'json' | 'ofx' | 'html';

export interface ParserWorkerRequest {
  format: ParserWorkerFormat;
  bank?: BankId;
  payload: ArrayBuffer;
}

interface SerializedParseError {
  message: string;
  code?: string;
  line?: number;
  raw?: string;
  file?: string;
  format?: ParseResult['format'];
}

interface SerializedParseResult extends Omit<ParseResult, 'errors'> {
  errors: SerializedParseError[];
}

export type ParserWorkerResponse =
  | { ok: true; result: SerializedParseResult }
  | { ok: false; message: string };

interface ParserWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ParserWorkerRequest>) => void,
  ): void;
  postMessage(message: ParserWorkerResponse): void;
}

function serializeResult(result: ParseResult): SerializedParseResult {
  return {
    ...result,
    errors: result.errors.map((error) => ({
      message: error.message,
      code: error.code,
      line: error.line,
      raw: error.raw,
      file: error.file,
      format: error.format,
    })),
  };
}

export function deserializeParserWorkerResult(
  result: SerializedParseResult,
): ParseResult {
  return {
    ...result,
    errors: result.errors.map(
      (error) =>
        new ParseError(error.message, {
          code: error.code,
          line: error.line,
          raw: error.raw,
          file: error.file,
          format: error.format,
        }),
    ),
  };
}

export function installParserWorker(
  parse: (
    payload: ArrayBuffer,
    bank?: BankId,
  ) => ParseResult | Promise<ParseResult>,
): void {
  const scope = globalThis as unknown as ParserWorkerScope;
  scope.addEventListener('message', (event) => {
    void Promise.resolve(parse(event.data.payload, event.data.bank)).then(
      (result) => {
        scope.postMessage({ ok: true, result: serializeResult(result) });
      },
      (error: unknown) => {
        scope.postMessage({
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
  });
}

export function decodeParserTextPayload(payload: ArrayBuffer): string {
  return new TextDecoder('utf-8').decode(new Uint8Array(payload));
}
