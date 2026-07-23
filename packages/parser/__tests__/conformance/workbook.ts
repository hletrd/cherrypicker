import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import xlsx from 'xlsx';

export interface WorkbookFixture {
  bytes: Uint8Array;
  withFile<T>(run: (filePath: string) => Promise<T>): Promise<T>;
}

export function createWorkbookFixture(
  rows: unknown[][],
  merges: xlsx.Range[] = [],
): WorkbookFixture {
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  sheet['!merges'] = merges;
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, '거래내역');
  const bytes = new Uint8Array(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

  return {
    bytes,
    async withFile<T>(run: (filePath: string) => Promise<T>): Promise<T> {
      const directory = await mkdtemp(join(tmpdir(), 'cherrypicker-conformance-'));
      const filePath = join(directory, 'statement.xlsx');
      try {
        await writeFile(filePath, bytes);
        return await run(filePath);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

export function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
