import type { ParseResult, BankId } from './types.js';
import { detectFormatFromFile, detectBankFromText } from './detect.js';
import { parseCSV } from './csv.js';
import { parseXLSX } from './xlsx.js';
import { parsePDF } from './pdf.js';

export type { FileFormat, BankId, DetectionResult, RawTransaction, ParseResult, ParseError, BankAdapter } from './types.js';
export { detectFormatFromFile, detectBank, detectBankFromText, detectCSVDelimiter } from './detect.js';
export { parseCSV } from './csv.js';
export { parseXLSX } from './xlsx.js';
export { parsePDF } from './pdf.js';

export async function parseFile(file: File, bank?: BankId): Promise<ParseResult> {
  const format = detectFormatFromFile(file);

  switch (format) {
    case 'csv': {
      let content: string;
      const buffer = await file.arrayBuffer();
      const ENCODINGS = ['utf-8', 'euc-kr', 'cp949'] as const;
      let bestContent = '';
      let bestReplacements = Infinity;

      for (const encoding of ENCODINGS) {
        try {
          const decoder = new TextDecoder(encoding);
          const decoded = decoder.decode(buffer);
          const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length;
          if (replacementCount < bestReplacements) {
            bestReplacements = replacementCount;
            bestContent = decoded;
          }
          if (replacementCount < 5) break;
        } catch { continue; }
      }

      content = bestContent || new TextDecoder('utf-8').decode(buffer);
      // Auto-detect bank from content if not specified
      const detectedBank = bank ?? detectBankFromText(content);
      const result = parseCSV(content, detectedBank ?? undefined);
      // Warn if encoding detection produced many replacement characters
      if (bestReplacements > 50) {
        result.errors.unshift({
          message: `파일 인코딩을 정확히 감지하지 못했어요. 일부 가맹점명이 깨질 수 있습니다.`,
        });
      }
      return result;
    }
    case 'xlsx': {
      const buffer = await file.arrayBuffer();
      return parseXLSX(buffer, bank);
    }
    case 'pdf': {
      const buffer = await file.arrayBuffer();
      return parsePDF(buffer, bank);
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(`지원하지 않는 형식이에요: ${_exhaustive}`);
    }
  }
}
