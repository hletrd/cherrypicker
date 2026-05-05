/** OFX (Open Financial Exchange) transaction parser.
 *  Parses OFX 1.x (SGML-style) and OFX 2.x (XML-style) bank statement files.
 *  OFX is the de facto standard for bank statement exports, used by Korean
 *  and international banks. Files typically have .ofx or .qfx extensions.
 *
 *  OFX 1.x uses SGML-style tags without closing delimiters:
 *    <DTPOSTED>20240115
 *    <TRNAMT>-15000.00
 *    <NAME>STARBUCKS
 *
 *  OFX 2.x uses XML-style with proper closing tags:
 *    <DTPOSTED>20240115</DTPOSTED>
 *    <TRNAMT>-15000.00</TRNAMT>
 *    <NAME>STARBUCKS</NAME>
 *
 *  Both styles are handled by the same regex-based extraction (C98-01). */

import type { BankId, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { parseDateStringToISO, isValidISODate } from '../date-utils.js';

/** Extract all STMTTRN transaction blocks from OFX content.
 *  Handles both SGML-style (no closing tags) and XML-style (closing tags).
 *  Each STMTTRN block contains transaction details like date, amount, name.
 *
 *  Supports both bank statements (<STMTRS>/<BANKTRANLIST>/<STMTTRN>) and
 *  credit card statements (<CCSTMTRS>/<BANKTRANLIST>/<STMTTRN>).
 *  Credit card OFX files use CREDITCARDMSGSRSV1 wrapper with CCSTMTTRNRS
 *  instead of the bank statement SIGNONMSGSRSV1/STMTTRNRS path (C99-03). */
function extractTransactionBlocks(content: string): string[] {
  const blocks: string[] = [];
  // Match STMTTRN blocks — in XML style, they have closing tags; in SGML
  // style, they end at the next STMTTRN or at a different top-level tag.
  // Use case-insensitive matching since OFX tags may vary in case.
  const xmlPattern = /<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi;
  let match = xmlPattern.exec(content);
  while (match) {
    blocks.push(match[1] ?? '');
    match = xmlPattern.exec(content);
  }
  // If no XML-style blocks found, try SGML-style extraction.
  // Terminators include both bank (STMTRS) and credit card (CCSTMTRS)
  // statement response wrappers, plus CREDITCARDMSGSRSV1 (C99-03).
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

/** Extract a tag value from a transaction block.
 *  Handles both SGML-style (`<TAG>value`) and XML-style (`<TAG>value</TAG>`).
 *  Returns the trimmed value, or empty string if not found. */
function extractTag(block: string, tagName: string): string {
  // Try XML-style first (with closing tag)
  const xmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
  const xmlMatch = block.match(xmlRe);
  if (xmlMatch) return (xmlMatch[1] ?? '').trim();
  // Try SGML-style (no closing tag — value extends to end of line or next tag)
  const sgmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<\\n\\r]+)`, 'i');
  const sgmlMatch = block.match(sgmlRe);
  if (sgmlMatch) return (sgmlMatch[1] ?? '').trim();
  return '';
}

/** Parse OFX YYYYMMDD date to ISO format.
 *  OFX uses YYYYMMDD format optionally followed by time: 20240115120000[0:GMT].
 *  We only need the date part (first 8 digits). */
function parseOFXDate(raw: string): string {
  // Strip any time suffix (e.g., "20240115120000[0:GMT]" -> "20240115")
  const dateStr = raw.replace(/[^0-9].*$/, '').slice(0, 8);
  if (/^\d{8}$/.test(dateStr)) {
    return parseDateStringToISO(dateStr);
  }
  return raw;
}

/** Parse an OFX amount string. OFX amounts use decimal format (e.g., "-15000.00").
 *  Korean Won amounts should be integers — round to nearest won.
 *  In OFX: negative amounts = charges/debits (money out), positive = credits.
 *  Returns the raw value (may be negative) so the caller can filter. */
function parseOFXAmount(raw: string): number | null {
  if (!raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n);
}

/** Parse OFX content and extract transactions.
 *  Handles both OFX 1.x (SGML) and OFX 2.x (XML) formats. */
export function parseOFX(content: string, bank?: BankId): ParseResult {
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  // Detect bank from content if not provided. Also try extracting from
  // OFX <ORG> tag which identifies the financial institution (C99-03).
  let resolvedBank: BankId | null = bank ?? null;
  if (!resolvedBank) {
    resolvedBank = detectBank(content).bank;
    // Try OFX <ORG> tag as fallback bank identification
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

  // Extract transaction blocks
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

    // Extract required fields
    const dtPosted = extractTag(block, 'DTPOSTED');
    const trnAmt = extractTag(block, 'TRNAMT');
    const name = extractTag(block, 'NAME');

    if (!dtPosted && !trnAmt) continue;

    // Parse date
    const dateRaw = dtPosted;
    const date = parseOFXDate(dateRaw);
    if (!isValidISODate(date) && dateRaw) {
      errors.push({ line: i + 1, message: `날짜를 해석할 수 없습니다: ${dateRaw}` });
    }

    // Parse amount — in OFX: negative = charges (money out), positive = credits.
    // We want charges (spending), so convert negative to positive for storage.
    // Skip zero and positive amounts (credits/payments/refunds).
    const rawAmount = parseOFXAmount(trnAmt);
    if (rawAmount === null) {
      if (trnAmt.trim()) {
        errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${trnAmt}` });
      }
      continue;
    }
    if (rawAmount >= 0) continue;
    const amount = Math.abs(rawAmount);

    // Build transaction
    const tx: RawTransaction = {
      date,
      merchant: name || extractTag(block, 'MEMO') || '',
      amount,
    };

    // Extract optional memo field
    const memo = extractTag(block, 'MEMO');
    if (memo && memo !== tx.memo) {
      tx.memo = memo;
    }

    // Extract optional category from TRNTYPE
    const trnType = extractTag(block, 'TRNTYPE');
    if (trnType) {
      // Map OFX transaction types to Korean categories
      const typeMap: Record<string, string> = {
        'DEBIT': '출금',
        'CREDIT': '입금',
        'CHECK': '수표',
        'INT': '이자',
        'DIV': '배당',
        'FEE': '수수료',
        'SRVCHG': '서비스요금',
        'DEP': '입금',
        'ATM': 'ATM',
        'POS': 'POS',
        'XFER': '이체',
        'PAYMENT': '결제',
        'CASH': '현금',
        'DIRECTDEP': '직접입금',
        'DIRECTDEBIT': '직접출금',
        'REPEATPMT': '정기결제',
        'OTHER': '기타',
      };
      tx.category = typeMap[trnType.toUpperCase()] ?? trnType;
    }

    transactions.push(tx);
  }

  return { bank: resolvedBank, format: 'ofx', transactions, errors };
}