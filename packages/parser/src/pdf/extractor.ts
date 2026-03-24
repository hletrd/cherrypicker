import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';

export async function extractText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
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
