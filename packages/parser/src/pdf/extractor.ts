import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';

/** Shared page text renderer — uses Y-coordinate changes to insert line
 *  breaks and X-position gaps to insert spaces between items on the same
 *  line. Used by both extractText and extractPages to ensure consistent
 *  text extraction (C14-02). */
function renderPageText(items: Array<{ str: string; transform: number[] }>): string {
  let lastY = -1;
  let lastEndX = -1;
  let text = '';
  for (const item of items) {
    const y = item.transform[5] ?? 0;
    if (lastY !== -1 && Math.abs(y - lastY) > 5) {
      text += '\n';
      lastEndX = -1;
    } else if (lastEndX !== -1 && item.str.length > 0) {
      // Add a space between items on the same line to prevent words
      // from merging. The column-boundary detection in table-parser.ts
      // relies on whitespace gaps between columns (C13-02/C14-02).
      text += ' ';
    }
    text += item.str;
    lastY = y;
    // Track approximate end X position for space insertion heuristic
    if (item.transform) {
      lastEndX = (item.transform[4] ?? 0) + item.str.length * 6;
    }
  }
  return text;
}

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
        const text = renderPageText(textContent.items);
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
        const text = renderPageText(textContent.items);
        pages.push(text);
        return text;
      });
    },
  });

  return pages;
}
