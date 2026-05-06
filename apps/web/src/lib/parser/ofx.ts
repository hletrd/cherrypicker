/** OFX (Open Financial Exchange) transaction parser — web-side.
 *  Parity with server-side packages/parser/src/ofx/index.ts (C98-01).
 *  Supports both bank statements (STMTRS) and credit card statements
 *  (CCSTMTRS) with proper SGML terminator patterns (C100-03). */

import type { BankId, ParseResult, RawTransaction } from './types.js';
import { ParseError } from './types.js';
import { detectBank } from './detect.js';
import { parseDateStringToISO, isValidISODate } from './date-utils.js';
import { parseAmountString } from './amount.js';

/** Extract all STMTTRN transaction blocks from OFX content. */
function extractTransactionBlocks(content: string): string[] {
  const blocks: string[] = [];
  const xmlPattern = /<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi;
  let match = xmlPattern.exec(content);
  while (match) {
    blocks.push(match[1] ?? '');
    match = xmlPattern.exec(content);
  }
  if (blocks.length === 0) {
    const sgmlPattern = /<STMTTRN[^>]*>([\s\S]*?)(?=<STMTTRN|<\/BANKTRANLIST|<\/STMTRS|<\/CCSTMTRS|<\/CREDITCARDMSGSRSV1|$)/gi;
    match = sgmlPattern.exec(content);
    while (match) {
      blocks.push(match[1] ?? '');
      match = sgmlPattern.exec(content);
    }
  }
  return blocks;
}

/** Escape regex metacharacters in a string for safe interpolation into RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract a tag value from a transaction block. */
function extractTag(block: string, tagName: string): string {
  const safeTag = escapeRegExp(tagName);
  const xmlRe = new RegExp(`<${safeTag}[^>]*>\\s*([^<]+?)\\s*</${safeTag}>`, 'i');
  const xmlMatch = block.match(xmlRe);
  if (xmlMatch) return (xmlMatch[1] ?? '').trim();
  const sgmlRe = new RegExp(`<${safeTag}[^>]*>\\s*([^<\\n\\r]+)`, 'i');
  const sgmlMatch = block.match(sgmlRe);
  if (sgmlMatch) return (sgmlMatch[1] ?? '').trim();
  return '';
}

/** Parse OFX YYYYMMDD date to ISO format.
 *  OFX uses YYYYMMDD format optionally followed by time: 20240115120000[0:GMT].
 *  If a timezone offset is present, convert to KST (UTC+9) before extracting
 *  the date so cross-midnight offsets don't produce the wrong local date.
 *
 *  The KST conversion works by computing UTC ms, adding 9 hours, then reading
 *  back with getUTC* — which yields KST values because the Date is shifted +9h.
 *  Using local getters (getFullYear etc.) would be incorrect in non-KST envs (C31-CR02). */
function parseOFXDate(raw: string): string {
  // Match: YYYYMMDD[HHMMSS[.sss][+offset:TZ]]]
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})(?:\.\d+)?(?:\[([+-]?\d+):[A-Z]+\])?)?/);
  if (!m) {
    const fallback = raw.replace(/[^0-9].*$/, '').slice(0, 8);
    return /^\d{8}$/.test(fallback) ? parseDateStringToISO(fallback) : raw;
  }

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);

  // No time component — just return the date as-is
  if (!m[4]) {
    return parseDateStringToISO(`${m[1]}${m[2]}${m[3]}`);
  }

  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = parseInt(m[6], 10);
  const tzOffset = m[7] ? parseInt(m[7], 10) : 0;

  // Convert to KST (UTC+9): local time - tzOffset = UTC; UTC + 9 = KST
  const utcMs = Date.UTC(year, month, day, hour, minute, second) - tzOffset * 3600000;
  const kst = new Date(utcMs + 9 * 3600000);

  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
}

/** Parse an OFX amount string. In OFX: negative = charges, positive = credits. */
/** Parse an OFX amount string. In OFX: negative = charges, positive = credits.
 *  Reuses parseAmountString for full-width digit and format normalization. */
function parseOFXAmount(raw: string): number | null {
  return parseAmountString(raw);
}

/** Parse OFX content and extract transactions. */
export function parseOFX(content: string, bank?: BankId): ParseResult {
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];
  // Detect bank from content if not provided. Also try extracting from
  // OFX <ORG> tag which identifies the financial institution (C100-03).
  let resolvedBank: BankId | null = bank ?? null;
  if (!resolvedBank) {
    resolvedBank = detectBank(content).bank;
    if (!resolvedBank) {
      const orgMatch = content.match(/<ORG>([^<\n]+)/i);
      if (orgMatch) {
        const orgResult = detectBank(orgMatch[1] ?? '');
        if (orgResult.bank && orgResult.confidence > 0) {
          resolvedBank = orgResult.bank;
        }
      }
    }
  }

  const blocks = extractTransactionBlocks(content);
  if (blocks.length === 0) {
    return {
      bank: resolvedBank,
      format: 'ofx',
      transactions: [],
      errors: [new ParseError('OFX 파일에서 거래 내역을 찾을 수 없습니다.')],
    };
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const dtPosted = extractTag(block, 'DTPOSTED');
    const trnAmt = extractTag(block, 'TRNAMT');
    const name = extractTag(block, 'NAME');

    if (!dtPosted && !trnAmt) continue;

    const date = parseOFXDate(dtPosted);
    if (!isValidISODate(date) && dtPosted) {
      errors.push(new ParseError(`날짜를 해석할 수 없습니다: ${dtPosted}`, { line: i + 1 }));
    }

    const rawAmount = parseOFXAmount(trnAmt);
    if (rawAmount === null) {
      if (trnAmt.trim()) {
        errors.push(new ParseError(`금액을 해석할 수 없습니다: ${trnAmt}`, { line: i + 1 }));
      }
      continue;
    }
    if (rawAmount >= 0) continue;
    const amount = Math.abs(rawAmount);

    const tx: RawTransaction = {
      date,
      merchant: name || extractTag(block, 'MEMO') || '',
      amount,
    };

    const memo = extractTag(block, 'MEMO');
    if (memo && memo !== tx.merchant) {
      tx.memo = memo;
    }

    const trnType = extractTag(block, 'TRNTYPE');
    if (trnType) {
      const typeMap: Record<string, string> = {
        'DEBIT': '출금', 'CREDIT': '입금', 'CHECK': '수표', 'INT': '이자',
        'DIV': '배당', 'FEE': '수수료', 'SRVCHG': '서비스요금', 'DEP': '입금',
        'ATM': 'ATM', 'POS': 'POS', 'XFER': '이체', 'PAYMENT': '결제',
        'CASH': '현금', 'DIRECTDEP': '직접입금', 'DIRECTDEBIT': '직접출금',
        'REPEATPMT': '정기결제', 'OTHER': '기타',
      };
      tx.category = typeMap[trnType.toUpperCase()] ?? trnType;
    }

    transactions.push(tx);
  }

  return { bank: resolvedBank, format: 'ofx', transactions, errors };
}