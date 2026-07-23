import type { ParseResult, BankId } from './types.js';
import { ParseError } from './types.js';
import { detectFormatFromFile, detectBankFromText } from './detect.js';
import { decodeTextBytes, detectTextEncoding } from '@cherrypicker/parser/browser';

export type { FileFormat, BankId, DetectionResult, RawTransaction, ParseResult, BankAdapter } from './types.js';
export { ParseError } from './types.js';
export { detectFormatFromFile, detectBank, detectBankFromText, detectCSVDelimiter } from './detect.js';

export async function parseFile(file: File, bank?: BankId): Promise<ParseResult> {
  const format = await detectFormatFromFile(file);

  switch (format) {
    case 'csv': {
      const { parseCSV } = await import('./csv.js');
      const buffer = await file.arrayBuffer();
      const arr = new Uint8Array(buffer);
      const encoding = detectTextEncoding(arr);
      const content = decodeTextBytes(arr, encoding);
      // Auto-detect bank from content if not specified
      const detectedBank = bank ?? detectBankFromText(content);
      const result = parseCSV(content, detectedBank ?? undefined);
      const replacementCount = (content.match(/\uFFFD/g) ?? []).length;
      if (replacementCount > 50) {
        result.errors.unshift(new ParseError(
          `파일 인코딩을 정확히 감지하지 못했어요. 일부 가맹점명이 깨질 수 있습니다.`,
        ));
      }
      return result;
    }
    case 'xlsx': {
      const { parseXLSX } = await import('./xlsx.js');
      const buffer = await file.arrayBuffer();
      return parseXLSX(buffer, bank);
    }
    case 'pdf': {
      const { parsePDF } = await import('./pdf.js');
      const buffer = await file.arrayBuffer();
      return parsePDF(buffer, bank);
    }
    case 'json': {
      const { parseJSON } = await import('./json.js');
      const content = await file.text();
      return parseJSON(content, bank);
    }
    case 'ofx': {
      const { parseOFX } = await import('./ofx.js');
      const content = await file.text();
      return parseOFX(content, bank);
    }
    case 'html': {
      const { parseHTML } = await import('./html.js');
      const content = await file.text();
      return parseHTML(content, bank);
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(`지원하지 않는 형식이에요: ${_exhaustive}`);
    }
  }
}
