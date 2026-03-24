import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    // TODO: Integrate with @cherrypicker/rules loader
    // const rules = await loadAllCardRules(CARDS_DIR);

    return new Response(
      JSON.stringify({
        cards: [],
        message: 'Card rules loader not yet connected',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load cards';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
