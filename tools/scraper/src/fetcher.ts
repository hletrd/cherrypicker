import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { LookupFunction } from 'node:net';
import {
  assertConnectedAddress,
  defaultDnsResolver,
  parseAllowedHosts,
  resolveValidatedTarget,
} from './network-policy.js';
import type {
  DnsResolver,
  ValidatedTarget,
} from './network-policy.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 30_000;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_MEDIA_TYPES = new Set(['text/html', 'application/xhtml+xml']);

export interface ScraperResponse {
  status: number;
  statusText: string;
  headers: Readonly<Record<string, string | undefined>>;
  body: AsyncIterable<Uint8Array>;
  cancel: () => void;
}

export type RequestHop = (
  target: ValidatedTarget,
  signal: AbortSignal,
) => Promise<ScraperResponse>;

export interface FetchCardPageOptions {
  allowedHosts: readonly string[];
  resolver?: DnsResolver;
  requestHop?: RequestHop;
  timeoutMs?: number;
  maxResponseBytes?: number;
  setTimer?: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

function deadlineError(timeoutMs: number): Error {
  return new Error(`페이지 요청 시간이 ${timeoutMs}ms를 초과했습니다.`);
}

function awaitWithinDeadline<T>(
  start: () => Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<T> {
  if (signal.aborted) return Promise.reject(deadlineError(timeoutMs));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(deadlineError(timeoutMs));
    signal.addEventListener('abort', onAbort, { once: true });

    let operation: Promise<T>;
    try {
      operation = start();
    } catch (error) {
      signal.removeEventListener('abort', onAbort);
      reject(error);
      return;
    }
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = Array.isArray(value)
      ? value.join(', ')
      : value;
  }
  return normalized;
}

function makePinnedLookup(target: ValidatedTarget): LookupFunction {
  return (_hostname, options, callback) => {
    const requestedFamily = options.family === 4 || options.family === 6
      ? options.family
      : undefined;
    const candidates = requestedFamily
      ? target.addresses.filter((entry) => entry.family === requestedFamily)
      : target.addresses;
    const selected = candidates[0];
    if (!selected) {
      callback(
        Object.assign(new Error('검증된 DNS 주소가 없습니다.'), { code: 'ENOTFOUND' }),
        '',
        0,
      );
      return;
    }
    if (options.all) {
      callback(
        null,
        candidates.map(({ address, family }) => ({ address, family })),
      );
      return;
    }
    callback(null, selected.address, selected.family);
  };
}

export const requestPinnedHop: RequestHop = (target, signal) =>
  new Promise<ScraperResponse>((resolve, reject) => {
    const request = target.url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(
      target.url,
      {
        method: 'GET',
        agent: false,
        signal,
        lookup: makePinnedLookup(target),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml;q=0.9',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'identity',
        },
      },
      (response: IncomingMessage) => {
        try {
          assertConnectedAddress(response.socket.remoteAddress, target);
        } catch (error) {
          response.destroy(error instanceof Error ? error : undefined);
          reject(error);
          return;
        }
        resolve({
          status: response.statusCode ?? 0,
          statusText: response.statusMessage ?? '',
          headers: normalizeHeaders(response.headers),
          body: response,
          cancel: () => response.destroy(),
        });
      },
    );
    req.once('error', reject);
    req.end();
  });

function parseContentLength(value: string | undefined, maximum: number): void {
  if (value === undefined) return;
  if (!/^\d+$/.test(value)) {
    throw new Error(`유효하지 않은 Content-Length 헤더입니다: "${value}"`);
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length > maximum) {
    throw new Error(`응답 본문이 너무 큽니다: ${value} > ${maximum} bytes`);
  }
}

async function readBoundedBody(
  response: ScraperResponse,
  maximum: number,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > maximum) {
        throw new Error(`응답 본문이 너무 큽니다: ${total} > ${maximum} bytes`);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    response.cancel();
    throw error;
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function detectCharset(contentType: string, bytes: Uint8Array): string {
  const headerCharset = contentType.match(/charset\s*=\s*["']?([^"';\s]+)/i)?.[1];
  const asciiHead = Buffer.from(bytes.subarray(0, 16_384)).toString('latin1');
  const metaCharset = asciiHead.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s;>]+)/i)?.[1];
  const charset = (headerCharset ?? metaCharset ?? 'utf-8').toLowerCase().replaceAll('_', '-');

  if (['euc-kr', 'ks-c-5601', 'ks-c-5601-1987', 'cp949', 'windows-949'].includes(charset)) {
    return 'euc-kr';
  }
  if (['utf-8', 'utf8'].includes(charset)) return 'utf-8';
  throw new Error(`지원하지 않는 HTML 문자 인코딩입니다: "${charset}"`);
}

/**
 * Fetch a card product page and return its raw HTML.
 * Handles Korean EUC-KR encoding by detecting charset and re-decoding if needed.
 * Aborts after 30 seconds to prevent hanging on unresponsive hosts.
 */
export async function fetchCardPage(
  url: string,
  options: FetchCardPageOptions,
): Promise<string> {
  const allowedHosts = parseAllowedHosts(options.allowedHosts);
  const resolver = options.resolver ?? defaultDnsResolver;
  const requestHop = options.requestHop ?? requestPinnedHop;
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maximum = options.maxResponseBytes ?? MAX_RESPONSE_BYTES;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const controller = new AbortController();
  const timeout = setTimer(() => controller.abort(), timeoutMs);
  const visited = new Set<string>();
  let currentUrl = url;
  let redirects = 0;

  try {
    while (true) {
      if (controller.signal.aborted) {
        throw deadlineError(timeoutMs);
      }
      const target = await awaitWithinDeadline(
        () => resolveValidatedTarget(currentUrl, allowedHosts, resolver),
        controller.signal,
        timeoutMs,
      );
      const href = target.url.href;
      if (visited.has(href)) {
        throw new Error(`리다이렉트 순환을 감지했습니다: ${href}`);
      }
      visited.add(href);

      const response = await awaitWithinDeadline(
        () => requestHop(target, controller.signal),
        controller.signal,
        timeoutMs,
      );
      if (REDIRECT_STATUSES.has(response.status)) {
        response.cancel();
        if (redirects >= MAX_REDIRECTS) {
          throw new Error(`리다이렉트가 ${MAX_REDIRECTS}회를 초과했습니다.`);
        }
        const location = response.headers['location'];
        if (!location) {
          throw new Error(`HTTP ${response.status} 응답에 Location 헤더가 없습니다.`);
        }
        currentUrl = new URL(location, target.url).href;
        redirects++;
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        response.cancel();
        throw new Error(
          `HTTP ${response.status} ${response.statusText} — ${target.url.href}`,
        );
      }

      const contentType = response.headers['content-type'];
      if (!contentType) {
        response.cancel();
        throw new Error('HTML 응답에 Content-Type 헤더가 없습니다.');
      }
      const mediaType = contentType.split(';', 1)[0]!.trim().toLowerCase();
      if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
        response.cancel();
        throw new Error(`HTML이 아닌 응답은 처리할 수 없습니다: "${mediaType}"`);
      }
      const contentEncoding = response.headers['content-encoding']?.trim().toLowerCase();
      if (contentEncoding && contentEncoding !== 'identity') {
        response.cancel();
        throw new Error(`지원하지 않는 Content-Encoding입니다: "${contentEncoding}"`);
      }

      try {
        parseContentLength(response.headers['content-length'], maximum);
        const bytes = await awaitWithinDeadline(
          () => readBoundedBody(response, maximum),
          controller.signal,
          timeoutMs,
        );
        const charset = detectCharset(contentType, bytes);
        if (charset === 'euc-kr') {
          return iconv.decode(Buffer.from(bytes), 'cp949');
        }
        return new TextDecoder(charset).decode(bytes);
      } catch (error) {
        response.cancel();
        throw error;
      }
    }
  } finally {
    clearTimer(timeout);
  }
}

/**
 * Use Cheerio to strip noise (scripts, styles, nav, footer, ads)
 * and extract the meaningful text content from the page.
 */
export function cleanHTML(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $(
    'script, style, noscript, iframe, svg, img, video, audio, ' +
    'nav, header, footer, aside, ' +
    '.gnb, .lnb, .snb, .footer, .header, .nav, ' +
    '#header, #footer, #nav, #gnb, #lnb, ' +
    '[class*="banner"], [class*="popup"], [class*="modal"], ' +
    '[class*="cookie"], [class*="toast"], [id*="popup"]',
  ).remove();

  // Extract main content areas first, fall back to body
  const mainSelectors = [
    'main',
    '#content',
    '#main',
    '.content',
    '.main',
    '[role="main"]',
    '.card-benefit',
    '.benefit-area',
    '.card-info',
    '.product-info',
  ];

  let content = '';
  for (const sel of mainSelectors) {
    const el = $(sel);
    if (el.length > 0) {
      content = el.text();
      break;
    }
  }

  if (!content) {
    content = $('body').text();
  }

  // Normalize whitespace: collapse runs of whitespace/newlines
  return content
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
