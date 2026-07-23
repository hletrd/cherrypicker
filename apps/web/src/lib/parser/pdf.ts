import { parsePDFText } from '@cherrypicker/parser/browser';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { detectBank } from './detect.js';
import type { BankId, ParseResult } from './types.js';
import { ParseError } from './types.js';

async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  // Keep PDF.js out of the server-rendered bundle and use the same-origin
  // worker emitted by the web build.
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let fullText = '';

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let lastY = -1;
    let lastEndX = -1;
    let pageText = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const transform = item.transform;
      if (!Array.isArray(transform) || transform.length < 6) continue;

      const y = transform[5] ?? 0;
      if (lastY !== -1 && Math.abs(y - lastY) > 5) {
        pageText += '\n';
        lastEndX = -1;
      } else if (lastEndX !== -1 && item.str.length > 0) {
        pageText += ' ';
      }

      pageText += item.str;
      lastY = y;
      lastEndX = (transform[4] ?? 0) + item.str.length * 6;
    }

    fullText += `${pageText}\n`;
  }

  return fullText;
}

export async function parsePDF(buffer: ArrayBuffer, bank?: BankId): Promise<ParseResult> {
  let text: string;
  try {
    text = await extractPDFText(buffer);
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
