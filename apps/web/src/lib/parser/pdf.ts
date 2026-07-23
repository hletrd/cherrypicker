import { parsePDFText } from '@cherrypicker/parser/browser';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { detectBank } from './detect.js';
import type { BankId, ParseResult } from './types.js';
import { ParseError } from './types.js';
import {
  extractPDFTextFromLoadingTask,
  type PDFLoadingTaskLike,
} from './pdf-lifecycle.js';

async function extractPDFText(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<string> {
  // Keep PDF.js out of the server-rendered bundle and use the same-origin
  // worker emitted by the web build.
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  return extractPDFTextFromLoadingTask(
    loadingTask as unknown as PDFLoadingTaskLike,
    signal,
  );
}

export async function parsePDF(
  buffer: ArrayBuffer,
  bank?: BankId,
  signal?: AbortSignal,
): Promise<ParseResult> {
  let text: string;
  try {
    text = await extractPDFText(buffer, signal);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
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

  return {
    bank: resolvedBank,
    format: 'pdf',
    transactions: [],
    errors: [
      ...local.errors,
      new ParseError('PDF에서 거래를 찾지 못했어요. CSV나 Excel 파일로 다시 시도해 보세요.'),
    ],
  };
}
