import { readFile } from 'fs/promises';
import type { BankId, ParseResult } from './types.js';
import { ParseError } from './types.js';
import { decodeStatementTextBytes } from './shared/encoding.js';
import {
  FILE_FORMAT_SNIFF_BYTES,
  decodeBuffer,
  detectBank,
  detectEncoding,
  detectFileFormatHint,
  detectFormatFromExtension,
  finalizeFileFormatHint,
  readFilePrefix,
} from './detect.js';

export interface ParseOptions {
  bank?: BankId;
  allowRemoteLLM?: boolean;
}

export interface StatementReadDependencies {
  readFile?: (filePath: string) => Promise<Uint8Array>;
  readPrefix?: (filePath: string, maxBytes: number) => Promise<Uint8Array>;
}

function enrichErrors(
  result: ParseResult,
  filePath: string,
  detectionErrors: ParseError[],
): ParseResult {
  for (const error of result.errors) {
    if (error instanceof ParseError) {
      if (!error.file) error.file = filePath;
      if (!error.format) error.format = result.format;
    }
  }
  if (detectionErrors.length > 0) {
    result.errors.unshift(...detectionErrors);
  }
  return result;
}

/**
 * Parse a credit card statement while loading only the selected format
 * adapter. Supported aliases: CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, HTML/HTM.
 * Text formats reuse one complete read for detection and parsing.
 */
export async function parseStatement(
  filePath: string,
  options?: ParseOptions,
  dependencies: StatementReadDependencies = {},
): Promise<ParseResult> {
  const readCompleteFile = dependencies.readFile ?? readFile;
  const readPrefix = dependencies.readPrefix ?? readFilePrefix;
  let completeBufferPromise: Promise<Buffer> | undefined;

  const readComplete = (): Promise<Buffer> => {
    completeBufferPromise ??= readCompleteFile(filePath).then((bytes) =>
      Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
    );
    return completeBufferPromise;
  };

  const extensionFormat = detectFormatFromExtension(filePath);
  const prefix = extensionFormat === 'csv'
    ? (await readComplete()).subarray(0, FILE_FORMAT_SNIFF_BYTES)
    : extensionFormat
      ? Buffer.alloc(0)
      : await readPrefix(filePath, FILE_FORMAT_SNIFF_BYTES);
  const hint = detectFileFormatHint(filePath, prefix);
  const validationBytes = hint.requiresCompleteJsonValidation
    ? await readComplete()
    : undefined;
  const detection = finalizeFileFormatHint(filePath, hint, validationBytes);
  const bank = options?.bank;

  switch (detection.format) {
    case 'csv': {
      const buffer = await readComplete();
      const encoding = detectEncoding(buffer);
      const content = decodeBuffer(buffer, encoding);
      const resolvedBank = bank ?? detectBank(content).bank ?? undefined;
      const { parseCSV } = await import('./csv/index.js');
      return enrichErrors(
        parseCSV(content, resolvedBank),
        filePath,
        detection.errors,
      );
    }

    case 'xlsx': {
      const { parseXLSXBuffer } = await import('./xlsx/index.js');
      return enrichErrors(
        parseXLSXBuffer(await readComplete(), bank),
        filePath,
        detection.errors,
      );
    }

    case 'pdf': {
      const { parsePDFBuffer } = await import('./pdf/index.js');
      return enrichErrors(
        await parsePDFBuffer(await readComplete(), bank, {
          allowRemoteLLM: options?.allowRemoteLLM ?? false,
        }),
        filePath,
        detection.errors,
      );
    }

    case 'json': {
      const content = decodeStatementTextBytes(await readComplete(), 'json');
      const { parseJSON } = await import('./json/index.js');
      return enrichErrors(
        parseJSON(content, bank),
        filePath,
        detection.errors,
      );
    }

    case 'ofx': {
      const content = decodeStatementTextBytes(await readComplete(), 'ofx');
      const { parseOFX } = await import('./ofx/index.js');
      return enrichErrors(
        parseOFX(content, bank),
        filePath,
        detection.errors,
      );
    }

    case 'html': {
      const content = decodeStatementTextBytes(await readComplete(), 'html');
      const { parseHTML } = await import('./html/index.js');
      return enrichErrors(
        parseHTML(content, bank),
        filePath,
        detection.errors,
      );
    }

    default: {
      const exhaustive: never = detection.format;
      return {
        bank: bank ?? null,
        format: detection.format,
        transactions: [],
        errors: [
          new ParseError(
            `지원하지 않는 파일 형식입니다: ${exhaustive}`,
            { file: filePath, format: detection.format },
          ),
        ],
      };
    }
  }
}
