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

export interface SerializedParseError {
  message: string;
  code?: string;
  line?: number;
  raw?: string;
  file?: string;
  format?: ParseResult['format'];
  count?: number;
}

export interface SerializedParseResult extends Omit<ParseResult, 'errors'> {
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

export const MAX_SERIALIZED_PARSE_ERRORS = 100;
export const MAX_SERIALIZED_PARSE_ERROR_MESSAGE_LENGTH = 1_024;
export const MAX_SERIALIZED_PARSE_ERROR_RAW_LENGTH = 2_048;

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function serializedErrorCount(error: { count?: number }): number {
  return Number.isSafeInteger(error.count)
    && error.count !== undefined
    && error.count > 0
    ? error.count
    : 1;
}

function addSafeCounts(total: number, count: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, total + count);
}

function serializeParseError(error: ParseError): SerializedParseError {
  return {
    message: truncate(
      error.message,
      MAX_SERIALIZED_PARSE_ERROR_MESSAGE_LENGTH,
    ) ?? '',
    code: error.code,
    line: error.line,
    raw: truncate(error.raw, MAX_SERIALIZED_PARSE_ERROR_RAW_LENGTH),
    file: error.file,
    format: error.format,
    count: error.count,
  };
}

export function serializeParserWorkerResult(
  result: ParseResult,
): SerializedParseResult {
  const hasOmittedErrors =
    result.errors.length > MAX_SERIALIZED_PARSE_ERRORS;
  const exampleLimit = hasOmittedErrors
    ? MAX_SERIALIZED_PARSE_ERRORS - 1
    : MAX_SERIALIZED_PARSE_ERRORS;
  const errors: SerializedParseError[] = [];
  let omittedCount = 0;

  for (const error of result.errors) {
    if (errors.length < exampleLimit) {
      errors.push(serializeParseError(error));
    } else {
      omittedCount = addSafeCounts(
        omittedCount,
        serializedErrorCount(error),
      );
    }
  }
  if (hasOmittedErrors) {
    errors.push({
      message: '나머지 파싱 경고를 요약했어요.',
      code: 'parse_diagnostics_omitted',
      count: omittedCount,
    });
  }

  return {
    ...result,
    errors,
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
          count: error.count,
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
        scope.postMessage({
          ok: true,
          result: serializeParserWorkerResult(result),
        });
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
