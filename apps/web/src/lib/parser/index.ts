import type { ParseResult, BankId } from './types.js';
import { ParseError } from './types.js';
import { detectFormatFromFile, detectBankFromText } from './detect.js';
import { decodeTextBytes, detectTextEncoding } from '@cherrypicker/parser/browser';
import {
  browserParserWorkersAvailable,
  parseWithWorker,
} from './worker-runner.js';

export type { FileFormat, BankId, DetectionResult, RawTransaction, ParseResult, BankAdapter } from './types.js';
export { ParseError } from './types.js';
export { detectFormatFromFile, detectBank, detectBankFromText, detectCSVDelimiter } from './detect.js';

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
  const format = await detectFormatFromFile(file);
  throwIfAborted(signal);

  switch (format) {
    case 'csv': {
      const buffer = await file.arrayBuffer();
      throwIfAborted(signal);
      const arr = new Uint8Array(buffer);
      const encoding = detectTextEncoding(arr);
      const content = decodeTextBytes(arr, encoding);
      // Auto-detect bank from content if not specified
      const detectedBank = bank ?? detectBankFromText(content);
      let result: ParseResult;
      if (browserParserWorkersAvailable()) {
        result = await parseWithWorker(
          {
            format: 'csv',
            payload: content,
            bank: detectedBank ?? undefined,
          },
          signal,
        );
      } else {
        const { parseCSV } = await import('./csv.js');
        throwIfAborted(signal);
        result = parseCSV(content, detectedBank ?? undefined);
      }
      const replacementCount = (content.match(/\uFFFD/g) ?? []).length;
      if (replacementCount > 50) {
        result.errors.unshift(new ParseError(
          `파일 인코딩을 정확히 감지하지 못했어요. 일부 가맹점명이 깨질 수 있습니다.`,
        ));
      }
      return result;
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
      const content = await file.text();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          { format: 'json', payload: content, bank },
          signal,
        );
      }
      const { parseJSON } = await import('./json.js');
      throwIfAborted(signal);
      return parseJSON(content, bank);
    }
    case 'ofx': {
      const content = await file.text();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          { format: 'ofx', payload: content, bank },
          signal,
        );
      }
      const { parseOFX } = await import('./ofx.js');
      throwIfAborted(signal);
      return parseOFX(content, bank);
    }
    case 'html': {
      const content = await file.text();
      throwIfAborted(signal);
      if (browserParserWorkersAvailable()) {
        return parseWithWorker(
          { format: 'html', payload: content, bank },
          signal,
        );
      }
      const { parseHTML } = await import('./html.js');
      throwIfAborted(signal);
      return parseHTML(content, bank);
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(`지원하지 않는 형식이에요: ${_exhaustive}`);
    }
  }
}
