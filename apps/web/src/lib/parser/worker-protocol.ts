import type { BankId, ParseResult } from './types.js';
import { ParseError } from './types.js';
import {
  decodeStatementTextBytes,
  type StatementTextFormat,
} from '@cherrypicker/parser/browser';

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
  | {
      ok: false;
      message: string;
      name?: string;
      code?: string;
      format?: string;
      encoding?: string;
    };

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

function stringProperty(
  value: unknown,
  property: 'name' | 'code' | 'format' | 'encoding',
): string | undefined {
  if (
    (typeof value !== 'object' || value === null)
    && typeof value !== 'function'
  ) {
    return undefined;
  }
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === 'string' ? candidate : undefined;
}

export function deserializeParserWorkerError(
  response: Extract<ParserWorkerResponse, { ok: false }>,
): Error & {
  code?: string;
  format?: string;
  encoding?: string;
} {
  const error = new Error(response.message) as Error & {
    code?: string;
    format?: string;
    encoding?: string;
  };
  if (response.name) error.name = response.name;
  if (response.code) error.code = response.code;
  if (response.format) error.format = response.format;
  if (response.encoding) error.encoding = response.encoding;
  return error;
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
          name: stringProperty(error, 'name'),
          code: stringProperty(error, 'code'),
          format: stringProperty(error, 'format'),
          encoding: stringProperty(error, 'encoding'),
        });
      },
    );
  });
}

export function decodeParserTextPayload(
  payload: ArrayBuffer,
  format: StatementTextFormat,
): string {
  return decodeStatementTextBytes(new Uint8Array(payload), format);
}
