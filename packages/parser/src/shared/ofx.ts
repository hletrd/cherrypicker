import { isValidISODate } from '../date-utils.js';

export interface OFXTransactionBlock {
  content: string;
  line: number;
}

function collectOFXBlocks(
  content: string,
  pattern: RegExp,
): OFXTransactionBlock[] {
  const blocks: OFXTransactionBlock[] = [];
  let line = 1;
  let scannedOffset = 0;
  let match = pattern.exec(content);

  while (match) {
    const blockOffset = match.index;
    while (scannedOffset < blockOffset) {
      const char = content.charCodeAt(scannedOffset);
      if (char === 0x0D) {
        line++;
        if (
          scannedOffset + 1 < blockOffset
          && content.charCodeAt(scannedOffset + 1) === 0x0A
        ) {
          scannedOffset++;
        }
      } else if (char === 0x0A) {
        line++;
      }
      scannedOffset++;
    }
    blocks.push({
      content: match[1] ?? '',
      line,
    });
    match = pattern.exec(content);
  }

  return blocks;
}

export function extractOFXTransactionBlocks(content: string): OFXTransactionBlock[] {
  const xmlBlocks = collectOFXBlocks(
    content,
    /<STMTTRN(?:\s[^>]*)?>([\s\S]*?)<\/STMTTRN\s*>/gi,
  );
  if (xmlBlocks.length > 0) return xmlBlocks;

  return collectOFXBlocks(
    content,
    /<STMTTRN(?:\s[^>]*)?>([\s\S]*?)(?=<STMTTRN(?:\s[^>]*)?>|<\/BANKTRANLIST|<\/STMTRS|<\/CCSTMTRS|<\/CREDITCARDMSGSRSV1|$)/gi,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractOFXTag(block: string, tagName: string): string {
  const safeTag = escapeRegExp(tagName);
  const xmlMatch = block.match(
    new RegExp(
      `<${safeTag}(?:\\s[^>]*)?>\\s*([^<]+?)\\s*</${safeTag}\\s*>`,
      'i',
    ),
  );
  if (xmlMatch) return (xmlMatch[1] ?? '').trim();

  const sgmlMatch = block.match(
    new RegExp(`<${safeTag}(?:\\s[^>]*)?>\\s*([^<\\n\\r]+)`, 'i'),
  );
  return sgmlMatch ? (sgmlMatch[1] ?? '').trim() : '';
}

const OFX_TIMESTAMP_PATTERN =
  /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})(?:\.(\d+))?(?:\[([+-]?\d{1,2}(?:\.\d+)?)(?::([^\]\r\n]+))?\])?)?$/;

/**
 * Parse an OFX date without allowing JavaScript's Date constructor to
 * normalize malformed calendar or clock components.
 */
export function parseOFXDateToISO(raw: string): string | null {
  const match = raw.match(OFX_TIMESTAMP_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const isoDate =
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (!isValidISODate(isoDate)) return null;

  if (match[4] === undefined) return isoDate;

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    !Number.isInteger(hour)
    || hour < 0
    || hour > 23
    || !Number.isInteger(minute)
    || minute < 0
    || minute > 59
    || !Number.isInteger(second)
    || second < 0
    || second > 60
  ) {
    return null;
  }

  const constructionSecond = Math.min(second, 59);
  let localMs = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    constructionSecond,
  );
  const local = new Date(localMs);
  if (
    local.getUTCFullYear() !== year
    || local.getUTCMonth() !== month - 1
    || local.getUTCDate() !== day
    || local.getUTCHours() !== hour
    || local.getUTCMinutes() !== minute
    || local.getUTCSeconds() !== constructionSecond
  ) {
    return null;
  }
  if (second === 60) localMs += 1_000;

  if (match[8] === undefined) return isoDate;

  const timezoneOffset = Number(match[8]);
  if (!Number.isFinite(timezoneOffset) || Math.abs(timezoneOffset) > 12) {
    return null;
  }

  const utcMs = localMs - timezoneOffset * 60 * 60 * 1_000;
  if (!Number.isFinite(utcMs)) return null;
  const kst = new Date(utcMs + 9 * 60 * 60 * 1_000);
  if (!Number.isFinite(kst.getTime())) return null;

  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
}
