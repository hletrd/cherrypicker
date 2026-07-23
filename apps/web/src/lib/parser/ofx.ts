/** OFX (Open Financial Exchange) transaction parser — web-side.
 *  Parity with server-side packages/parser/src/ofx/index.ts (C98-01).
 *  Supports both bank statements (STMTRS) and credit card statements
 *  (CCSTMTRS) with proper SGML terminator patterns (C100-03). */

import type { BankId, ParseResult, RawTransaction } from './types.js';
import { ParseError } from './types.js';
import { detectBank } from './detect.js';
import { parseAmountString } from './amount.js';
import {
  extractOFXTag,
  extractOFXTransactionBlocks,
  MAX_REQUIRED_FIELD_ROW_ERRORS,
  normalizeRequiredMerchant,
  parseOFXDateToISO,
  REQUIRED_MERCHANT_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_MESSAGE,
  resolveOFXStatementCurrency,
} from '@cherrypicker/parser/browser';

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

  const currency = resolveOFXStatementCurrency(content);
  if (currency.status === 'missing') {
    return {
      bank: resolvedBank,
      format: 'ofx',
      transactions: [],
      errors: [new ParseError(
        'OFX 통화 정보(CURDEF)가 없습니다. KRW 명세서만 분석할 수 있습니다.',
        { code: 'ofx_missing_currency' },
      )],
    };
  }
  if (currency.status === 'unsupported') {
    return {
      bank: resolvedBank,
      format: 'ofx',
      transactions: [],
      errors: [new ParseError(
        `지원하지 않는 OFX 통화입니다: ${currency.currency.slice(0, 16)}. KRW 명세서만 분석할 수 있습니다.`,
        { code: 'ofx_unsupported_currency' },
      )],
    };
  }
  if (currency.status === 'ambiguous') {
    return {
      bank: resolvedBank,
      format: 'ofx',
      transactions: [],
      errors: [new ParseError(
        'OFX 통화 정보(CURDEF)가 거래 명세서와 일치하지 않습니다. 각 명세서에 KRW 통화가 하나씩 선언되어야 합니다.',
        { code: 'ofx_ambiguous_currency' },
      )],
    };
  }

  const blocks = extractOFXTransactionBlocks(content);
  if (blocks.length === 0) {
    return {
      bank: resolvedBank,
      format: 'ofx',
      transactions: [],
      errors: [new ParseError('OFX 파일에서 거래 내역을 찾을 수 없습니다.')],
    };
  }

  let requiredMerchantErrorCount = 0;
  for (let i = 0; i < blocks.length; i++) {
    const { content: block, line } = blocks[i]!;
    const dtPosted = extractOFXTag(block, 'DTPOSTED');
    const trnAmt = extractOFXTag(block, 'TRNAMT');
    const name = extractOFXTag(block, 'NAME');
    const memo = extractOFXTag(block, 'MEMO');
    const merchant = normalizeRequiredMerchant(name || memo);

    let missingRequiredField = false;
    if (!dtPosted) {
      errors.push(new ParseError('필수 OFX 필드가 없습니다: DTPOSTED', {
        code: 'ofx_missing_dtposted',
        line,
      }));
      missingRequiredField = true;
    }
    if (!trnAmt) {
      errors.push(new ParseError('필수 OFX 필드가 없습니다: TRNAMT', {
        code: 'ofx_missing_trnamt',
        line,
      }));
      missingRequiredField = true;
    }
    if (!merchant) {
      if (requiredMerchantErrorCount < MAX_REQUIRED_FIELD_ROW_ERRORS) {
        errors.push(new ParseError(REQUIRED_MERCHANT_ERROR_MESSAGE, {
          code: REQUIRED_MERCHANT_ERROR_CODE,
          line,
        }));
      }
      requiredMerchantErrorCount++;
      missingRequiredField = true;
    }
    if (missingRequiredField) continue;

    const date = parseOFXDateToISO(dtPosted);
    if (!date) {
      errors.push(new ParseError(`날짜를 해석할 수 없습니다: ${dtPosted}`, { line }));
      continue;
    }

    // NOTE(C32-V10): parseOFXAmount delegates to parseAmountString, which
    // intentionally accepts extended Korean formats (full-width digits, ₩/원,
    // KRW prefix, 마이너스) for permissive bank-export compatibility.
    const rawAmount = parseOFXAmount(trnAmt);
    if (rawAmount === null) {
      if (trnAmt.trim()) {
        errors.push(new ParseError(`금액을 해석할 수 없습니다: ${trnAmt}`, { line }));
      }
      continue;
    }
    if (rawAmount >= 0) {
      errors.push(new ParseError(
        `입금/환불 내역은 지출로 처리되지 않습니다: ${merchant} ${rawAmount}원`,
        { line },
      ));
      continue;
    }
    const amount = Math.abs(rawAmount);

    const tx: RawTransaction = {
      date,
      merchant,
      amount,
    };

    if (memo && memo !== tx.merchant) {
      tx.memo = memo;
    }

    const trnType = extractOFXTag(block, 'TRNTYPE');
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
