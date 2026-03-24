import type { APIRoute } from 'astro';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

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

    await mkdir(UPLOAD_DIR, { recursive: true });

    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = join(UPLOAD_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        filePath,
        size: file.size,
        type: file.type,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
