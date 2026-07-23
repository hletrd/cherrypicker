import type { BankId, ParseResult } from '../types.js';
import { ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { parsePDFText } from '../shared/pdf-text.js';
import { extractText, extractTextFromBuffer } from './extractor.js';
import { parsePDFWithLLM } from './llm-fallback.js';

export interface PDFParseOptions {
  allowRemoteLLM?: boolean;
}

export async function parsePDF(
  filePath: string,
  bank?: BankId,
  options: PDFParseOptions = {},
): Promise<ParseResult> {
  let text: string;
  try {
    text = await extractText(filePath);
  } catch (error) {
    return {
      bank: bank ?? null,
      format: 'pdf',
      transactions: [],
      errors: [
        new ParseError(
          `PDF 텍스트 추출 실패: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
    };
  }

  return parseExtractedPDFText(text, bank, options);
}

export async function parsePDFBuffer(
  buffer: Uint8Array,
  bank?: BankId,
  options: PDFParseOptions = {},
): Promise<ParseResult> {
  let text: string;
  try {
    text = await extractTextFromBuffer(buffer);
  } catch (error) {
    return {
      bank: bank ?? null,
      format: 'pdf',
      transactions: [],
      errors: [
        new ParseError(
          `PDF 텍스트 추출 실패: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
    };
  }
  return parseExtractedPDFText(text, bank, options);
}

async function parseExtractedPDFText(
  text: string,
  bank: BankId | undefined,
  options: PDFParseOptions,
): Promise<ParseResult> {
  const resolvedBank = bank ?? detectBank(text).bank;
  const local = parsePDFText(text);
  if (local.transactions.length > 0) {
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: local.transactions,
      errors: local.errors,
    };
  }

  const errors = [...local.errors];
  if (!options.allowRemoteLLM) {
    errors.push(new ParseError(
      '구조화된 PDF 파싱에 실패했습니다. 원격 LLM 폴백은 기본적으로 비활성화되어 있습니다. 명시적으로 허용하려면 --allow-remote-llm 플래그를 사용하세요.',
      { code: 'REMOTE_LLM_REQUIRED' },
    ));
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: [],
      errors,
    };
  }

  errors.push(new ParseError('구조화된 파싱 실패, 명시적으로 허용된 LLM 폴백을 시도합니다...'));
  try {
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: await parsePDFWithLLM(text),
      errors,
    };
  } catch (error) {
    errors.push(new ParseError(
      `LLM 폴백 실패: ${error instanceof Error ? error.message : String(error)}`,
    ));
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: [],
      errors,
    };
  }
}
