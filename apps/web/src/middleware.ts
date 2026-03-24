import { defineMiddleware } from 'astro:middleware';

// --- In-memory rate limiter ---
const RATE_LIMITS = new Map<string, { count: number; resetAt: number }>();
const MAX_UPLOAD_REQUESTS = 10;
const MAX_ANALYZE_REQUESTS = 20;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  const key = `${ip}:${limit}`;
  const entry = RATE_LIMITS.get(key);
  if (!entry || now > entry.resetAt) {
    RATE_LIMITS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of RATE_LIMITS) {
    if (now > entry.resetAt) RATE_LIMITS.delete(key);
  }
}, 5 * 60_000);

export const onRequest = defineMiddleware(async ({ request, url, clientAddress }, next) => {
  const ip = clientAddress ?? request.headers.get('x-forwarded-for') ?? 'unknown';

  // Rate limiting for upload and analyze
  if (url.pathname === '/api/upload' && request.method === 'POST') {
    if (!checkRateLimit(ip, MAX_UPLOAD_REQUESTS)) {
      return new Response(JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
  }
  if (url.pathname === '/api/analyze' && request.method === 'POST') {
    if (!checkRateLimit(ip, MAX_ANALYZE_REQUESTS)) {
      return new Response(JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
  }

  // CSRF protection for POST endpoints
  if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const expectedOrigin = url.origin;
    if (origin && origin !== expectedOrigin) {
      return new Response(JSON.stringify({ error: 'CSRF 검증 실패' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const response = await next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"
  );

  return response;
});
