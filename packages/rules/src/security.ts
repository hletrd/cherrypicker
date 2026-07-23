import { z } from 'zod';

export const SCRAPER_ISSUERS = [
  'hyundai',
  'kb',
  'samsung',
  'shinhan',
  'lotte',
  'hana',
  'woori',
  'ibk',
  'nh',
  'bc',
] as const;

export type ScraperIssuer = (typeof SCRAPER_ISSUERS)[number];

export const CARD_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export const CARD_ID_MAX_LENGTH = 100;

export const cardIdSchema = z
  .string()
  .min(1)
  .max(CARD_ID_MAX_LENGTH)
  .regex(
    CARD_ID_PATTERN,
    'Card ID must contain only lowercase letters, digits, dots, and hyphens without leading or trailing separators',
  );

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

/**
 * Return an unchanged absolute HTTP(S) URL, or undefined when the value is
 * absent or unsafe for an external href.
 */
export function safeExternalUrl(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') return undefined;
  if (value !== value.trim() || CONTROL_CHARACTER_PATTERN.test(value)) return undefined;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.username !== '' || parsed.password !== '') return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export const safeExternalUrlSchema = z
  .string()
  .refine(
    (value) => value === '' || safeExternalUrl(value) !== undefined,
    'URL must be empty or an absolute HTTP(S) URL without credentials, whitespace, or control characters',
  );
