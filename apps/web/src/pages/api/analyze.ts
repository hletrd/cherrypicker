import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { filePath, bank, previousMonthSpending } = await request.json();

    if (!filePath) {
      return new Response(JSON.stringify({ error: '파일 경로가 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: Integrate with @cherrypicker/parser and @cherrypicker/core
    // 1. parseStatement(filePath, { bank })
    // 2. categorize transactions
    // 3. calculate rewards for each card
    // 4. run optimizer

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analysis pipeline not yet connected',
        params: { filePath, bank, previousMonthSpending },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
