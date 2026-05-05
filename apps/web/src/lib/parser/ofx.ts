/** OFX (Open Financial Exchange) transaction parser — web-side.
 *  Parity with server-side packages/parser/src/ofx/index.ts (C98-01).
 *  Supports both bank statements (STMTRS) and credit card statements
 *  (CCSTMTRS) with proper SGML terminator patterns (C100-03). */

import type { BankId, ParseResult, RawTransaction, ParseError } from './types.js';
import { detectBank } from './detect.js';
import { parseDateStringToISO, isValidISODate } from './date-utils.js';

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

/** Extract a tag value from a transaction block. */
function extractTag(block: string, tagName: string): string {
  const xmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
  const xmlMatch = block.match(xmlRe);
  if (xmlMatch) return (xmlMatch[1] ?? '').trim();
  const sgmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<\\n\\r]+)`, 'i');
  const sgmlMatch = block.match(sgmlRe);
  if (sgmlMatch) return (sgmlMatch[1] ?? '').trim();
  return '';
}

/** Parse OFX YYYYMMDD date to ISO format. */
function parseOFXDate(raw: string): string {
  const dateStr = raw.replace(/[^0-9].*$/, '').slice(0, 8);
  if (/^\d{8}$/.test(dateStr)) {
    return parseDateStringToISO(dateStr);
  }
  return raw;
}

/** Parse an OFX amount string. In OFX: negative = charges, positive = credits. */
function parseOFXAmount(raw: string): number | null {
  if (!raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n);
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
      errors: [{ message: 'OFX 파일에서 거래 내역을 찾을 수 없습니다.' }],
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
      errors.push({ line: i + 1, message: `날짜를 해석할 수 없습니다: ${dtPosted}` });
    }

    const rawAmount = parseOFXAmount(trnAmt);
    if (rawAmount === null) {
      if (trnAmt.trim()) {
        errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${trnAmt}` });
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