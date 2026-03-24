import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Fetch a card product page and return its raw HTML.
 * Handles Korean EUC-KR encoding by detecting charset and re-decoding if needed.
 */
export async function fetchCardPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`);
  }

  const contentType = response.headers.get('content-type') ?? '';

  // Check for EUC-KR encoding (common on older Korean banking sites)
  const isEucKr =
    contentType.toLowerCase().includes('euc-kr') ||
    contentType.toLowerCase().includes('ks_c_5601');

  if (isEucKr) {
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    return decoder.decode(buffer);
  }

  const text = await response.text();

  // Also check meta charset in HTML head for cases where Content-Type doesn't specify
  const metaCharset = text.match(/<meta[^>]+charset=["']?([^"'\s;>]+)/i)?.[1]?.toLowerCase();
  if (metaCharset && (metaCharset === 'euc-kr' || metaCharset === 'ks_c_5601-1987')) {
    const buffer = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    }).then((r) => r.arrayBuffer());
    const decoder = new TextDecoder('euc-kr');
    return decoder.decode(buffer);
  }

  return text;
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
