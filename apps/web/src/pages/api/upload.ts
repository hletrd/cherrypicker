import type { APIRoute } from 'astro';
import { writeFile, mkdir, readdir, lstat, unlink } from 'node:fs/promises';
import { join, extname, basename, resolve } from 'path';
import { randomBytes } from 'node:crypto';
import { detectFormat } from '@cherrypicker/parser';

const UPLOAD_DIR = resolve(join(process.cwd(), 'uploads'));
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf'];
const ONE_HOUR_MS = 60 * 60 * 1000;

async function cleanupOldUploads(): Promise<void> {
  try {
    const files = await readdir(UPLOAD_DIR);
    const now = Date.now();
    await Promise.all(
      files.map(async (file) => {
        const filePath = join(UPLOAD_DIR, file);
        const fileStat = await lstat(filePath);
        if (fileStat.isFile() && now - fileStat.mtimeMs > ONE_HOUR_MS) {
          await unlink(filePath);
        }
      }),
    );
  } catch {
    // Non-blocking: ignore cleanup errors
  }
}

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  if (ext === '.pdf') return buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
  if (ext === '.xlsx') return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b; // PK (ZIP)
  if (ext === '.xls') return buffer.length >= 2 && buffer[0] === 0xd0 && buffer[1] === 0xcf; // OLE
  if (ext === '.csv') return buffer.length > 0 && !buffer.subarray(0, 1024).includes(0x00); // text, no null bytes
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: '파일이 없습니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // C2 - File size limit (10MB max)
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: '파일 크기가 10MB를 초과합니다' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // C1 - Sanitize filename: strip path separators and disallowed characters
    const safeName = basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');

    // H5 - Server-side extension validation
    const ext = extname(safeName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return new Response(
        JSON.stringify({ error: '지원하지 않는 파일 형식입니다. CSV, XLSX, XLS, PDF 파일만 허용됩니다' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const timestamp = Date.now();
    const randomSuffix = randomBytes(16).toString('hex');
    const fileName = `${timestamp}-${randomSuffix}-${safeName}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // C1 - Path traversal guard
    const resolvedPath = resolve(filePath);
    if (!resolvedPath.startsWith(resolve(UPLOAD_DIR) + '/')) {
      return new Response(JSON.stringify({ error: 'Invalid file name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!validateMagicBytes(buffer, ext)) {
      return new Response(JSON.stringify({ error: '파일 내용이 확장자와 일치하지 않습니다' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    await writeFile(filePath, buffer);

    // Auto-detect format and bank after writing
    const detection = await detectFormat(filePath);

    // M12 - Schedule cleanup of old files (non-blocking)
    void cleanupOldUploads();

    // H6 - Return only fileName, not full filePath
    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        size: file.size,
        type: file.type,
        detection: {
          format: detection.format,
          bank: detection.bank,
          confidence: detection.confidence,
          encoding: detection.encoding,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[api/upload]', error);
    return new Response(JSON.stringify({ error: '파일 업로드 중 오류가 발생했습니다' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
