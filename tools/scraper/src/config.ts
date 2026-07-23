import { SCRAPER_ISSUERS } from '@cherrypicker/rules';
import type { ScraperIssuer } from '@cherrypicker/rules';

export { SCRAPER_ISSUERS };
export type { ScraperIssuer };

const SCRAPER_ISSUER_SET = new Set<string>(SCRAPER_ISSUERS);

export function isScraperIssuer(value: string): value is ScraperIssuer {
  return SCRAPER_ISSUER_SET.has(value);
}

export function parseScraperIssuer(value: string): ScraperIssuer {
  if (!isScraperIssuer(value)) {
    throw new Error(
      `지원하지 않는 카드사입니다: "${value}". 지원 카드사: ${SCRAPER_ISSUERS.join(', ')}`,
    );
  }
  return value;
}
