import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';

export async function extractText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const pages = await extractPagesFromBuffer(buffer);
  return pages.join('\n');
}

/** Extract text from a PDF buffer, preserving line structure by using
 *  Y-coordinate changes to insert line breaks (C13-02). This gives better
 *  results than pdf-parse's default text extraction which may merge
 *  adjacent text items on the same line without whitespace. */
async function extractPagesFromBuffer(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];

  await pdfParse(buffer, {
    pagerender(pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) {
      return pageData.getTextContent().then((textContent) => {
        let lastY = -1;
        let lastEndX = -1;
        let text = '';
        for (const item of textContent.items) {
          const y = item.transform[5];
          if (lastY !== -1 && Math.abs(y - lastY) > 5) {
            text += '\n';
            lastEndX = -1;
          } else if (lastEndX !== -1 && item.str.length > 0) {
            // Add a space between items on the same line to prevent words
            // from merging (e.g., "2024-01-15카드결제" → "2024-01-15 카드결제").
            // The column-boundary detection in table-parser.ts relies on
            // whitespace gaps between columns, so preserving spaces is
            // important for correct table parsing (C13-02).
            text += ' ';
          }
          text += item.str;
          lastY = y;
          // Track approximate end X position for space insertion heuristic
          if (item.transform) {
            lastEndX = (item.transform[4] ?? 0) + item.str.length * 6;
          }
        }
        pages.push(text);
        return text;
      });
    },
  });

  return pages;
}

export async function extractPages(filePath: string): Promise<string[]> {
  const buffer = await readFile(filePath);
  const pages: string[] = [];

  await pdfParse(buffer, {
    pagerender(pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) {
      return pageData.getTextContent().then((textContent) => {
        let lastY = -1;
        let text = '';
        for (const item of textContent.items) {
          const y = item.transform[5];
          if (lastY !== -1 && Math.abs(y - lastY) > 5) {
            text += '\n';
          }
          text += item.str;
          lastY = y;
        }
        pages.push(text);
        return text;
      });
    },
  });

  return pages;
}
