import { finalizeStatementFormatHint } from '@cherrypicker/parser/browser';
import type { ParseResult, BankId, FileFormat } from './types.js';
import { detectFormatHintFromFile } from './detect.js';
import { decodeParserTextPayload } from './worker-protocol.js';
import {
  browserParserWorkersAvailable,
  parseWithWorker,
} from './worker-runner.js';

export type { FileFormat, BankId, DetectionResult, RawTransaction, ParseResult, BankAdapter } from './types.js';
export { ParseError } from './types.js';
export {
  detectFormatFromFile,
  detectBank,
  detectBankFromText,
  detectCSVDelimiter,
} from './detect.js';

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('분석이 취소되었어요.', 'AbortError');
  }
}

export async function parseFile(
  file: File,
  bank?: BankId,
  signal?: AbortSignal,
): Promise<ParseResult> {
  throwIfAborted(signal);
  const hint = await detectFormatHintFromFile(file);
  throwIfAborted(signal);
  let format: FileFormat = hint.format;
  let bufferedPayload: ArrayBuffer | undefined;

  if (hint.requiresCompleteJsonValidation) {
    bufferedPayload = await file.arrayBuffer();
    throwIfAborted(signal);
    if (browserParserWorkersAvailable()) {
      const jsonResult = await parseWithWorker(
        { format: 'json', payload: bufferedPayload, bank },
        signal,
      );
      if (!jsonResult.errors.some((error) => error.code === 'json_syntax')) {
        return jsonResult;
      }

      const csvPayload = await file.arrayBuffer();
      throwIfAborted(signal);
      return parseWithWorker(
        { format: 'csv', payload: csvPayload, bank },
        signal,
      );
    }
    format = finalizeStatementFormatHint(
      hint,
      new Uint8Array(bufferedPayload),
    );
  }

  switch (format) {
    case 'csv': {
      const buffer = bufferedPayload ?? await file.arrayBuffer();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          {
            format: 'csv',
            payload: buffer,
            bank,
          },
          signal,
        );
      }
      const { parseCSVBuffer } = await import('./csv.js');
      throwIfAborted(signal);
      return parseCSVBuffer(buffer, bank);
    }
    case 'xlsx': {
      const buffer = await file.arrayBuffer();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          { format: 'xlsx', payload: buffer, bank },
          signal,
        );
      }
      const { parseXLSX } = await import('./xlsx.js');
      throwIfAborted(signal);
      return parseXLSX(buffer, bank);
    }
    case 'pdf': {
      const { parsePDF } = await import('./pdf.js');
      throwIfAborted(signal);
      const buffer = await file.arrayBuffer();
      throwIfAborted(signal);
      return parsePDF(buffer, bank, signal);
    }
    case 'json': {
      const buffer = bufferedPayload ?? await file.arrayBuffer();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          { format: 'json', payload: buffer, bank },
          signal,
        );
      }
      const { parseJSON } = await import('./json.js');
      throwIfAborted(signal);
      return parseJSON(decodeParserTextPayload(buffer, 'json'), bank);
    }
    case 'ofx': {
      const buffer = await file.arrayBuffer();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          { format: 'ofx', payload: buffer, bank },
          signal,
        );
      }
      const { parseOFX } = await import('./ofx.js');
      throwIfAborted(signal);
      return parseOFX(decodeParserTextPayload(buffer, 'ofx'), bank);
    }
    case 'html': {
      const buffer = await file.arrayBuffer();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          { format: 'html', payload: buffer, bank },
          signal,
        );
      }
      const { parseHTML } = await import('./html.js');
      throwIfAborted(signal);
      return parseHTML(decodeParserTextPayload(buffer, 'html'), bank);
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(`지원하지 않는 형식이에요: ${_exhaustive}`);
    }
  }
}
