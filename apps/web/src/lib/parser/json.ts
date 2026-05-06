/** JSON transaction parser (web-side).
 *  Parity with server-side packages/parser/src/json/index.ts (C97-01).
 *  Import paths differ but implementations are identical (C31-DOC02).
 *  Parses JSON arrays of transaction objects from banking APIs, mobile app
 *  exports, and financial tools. */

import type { BankId, ParseResult, RawTransaction } from './types.js';
import { ParseError } from './types.js';
import { parseCSVAmount } from './csv.js';
import { parseDateStringToISO, isValidISODate } from './date-utils.js';

/** Field name aliases for date, merchant, and amount fields. */
const DATE_ALIASES = [
  'date', 'transactionDate', 'transaction_date', 'transDate', 'trans_date',
  'purchaseDate', 'purchase_date', 'orderDate', 'order_date', 'bookDate',
  'book_date', 'posted', 'postedDate', 'posted_date', 'billing', 'billingDate',
  'billing_date', 'settlementDate', 'settlement_date', 'paymentDate', 'payment_date',
  'timestamp', 'txnDate', 'txn_date', 'transDt', 'trans_dt',
  '이용일', '이용일자', '거래일', '거래일시', '날짜', '결제일', '승인일',
  '승인일자', '매출일', '작성일', '사용일', '처리일', '주문일', '입금일',
];

const MERCHANT_ALIASES = [
  'merchant', 'store', 'shop', 'vendor', 'description', 'desc', 'item',
  'name', 'payee', 'seller', 'company', 'business', 'recipient', 'outlet',
  'supplier', 'brand', 'location', 'details', 'reference', 'transaction',
  'merchantName', 'merchant_name', 'storeName', 'store_name',
  '이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처',
  '결제처', '상호', '판매처', '구매처', '매장', '이용내용', '거래내용',
  '상호명', '업체명', '판매자', '거래내역', '상점',
];

const AMOUNT_ALIASES = [
  'amount', 'amt', 'total', 'price', 'won', 'charge', 'payment', 'paid',
  'spent', 'cost', 'value', 'debit', 'credit', 'net', 'netAmount', 'net_amount',
  'gross', 'transactionAmount', 'transaction_amount', 'paymentAmount', 'payment_amount',
  'billedAmount', 'billed_amount', 'totalAmount', 'total_amount',
  '이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액',
  '청구금액', '출금액', '사용금액', '결제대금',
];

const INSTALLMENTS_ALIASES = [
  'installments', 'install', 'installment', 'installmentCount', 'installment_count',
  '할부', '할부개월', '할부기간',
];

const CATEGORY_ALIASES = [
  'category', 'type', 'paymentType', 'payment_type', 'paymentMethod', 'payment_method',
  '업종', '카테고리', '분류', '업종분류', '거래유형', '결제유형', '결제구분', '구분',
];

const MEMO_ALIASES = [
  'memo', 'note', 'notes', 'remarks', 'remark',
  // NOTE: 'description' is intentionally listed here as a fallback but will
  // never match because it is also in MERCHANT_ALIASES and findField scans
  // aliases in order. Merchant takes precedence.
  'description' /* fallback: never matches — see note above */,
  '비고', '적요', '메모', '내용', '설명', '참고', '상세내역', '승인번호',
];

/** Find the first matching field name from a set of aliases in an object.
 *  Returns the value if found, undefined otherwise.
 *  Scans aliases in order — the first match wins. This means if the same
 *  field name appears in multiple alias lists (e.g., 'description' in both
 *  MERCHANT_ALIASES and MEMO_ALIASES), the list scanned first determines
 *  the match. */
function findField(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (Object.hasOwn(obj, alias)) return obj[alias];
    const lower = alias.toLowerCase();
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === lower) return obj[key];
    }
  }
  return undefined;
}

function normalizeAmount(raw: unknown, lineIdx: number, errors: ParseError[]): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw) : null;
  }
  if (typeof raw === 'string') {
    const parsed = parseCSVAmount(raw);
    return parsed !== null && Number.isFinite(parsed) ? parsed : null;
  }
  if (raw === null || raw === undefined) {
    return null;
  }
  // Boolean or other unexpected type — report as error
  errors.push(new ParseError(
    `금액 필드에 예상치 못한 타입(${typeof raw})이 있습니다: ${String(raw)}`,
    { line: lineIdx }
  ));
  return null;
}

function parseTransactionObject(
  obj: Record<string, unknown>,
  lineIdx: number,
  errors: ParseError[],
): RawTransaction | null {
  const dateValue = findField(obj, DATE_ALIASES);
  const amountValue = findField(obj, AMOUNT_ALIASES);
  const merchantValue = findField(obj, MERCHANT_ALIASES);

  if (dateValue === undefined || amountValue === undefined) return null;

  const dateRaw = String(dateValue ?? '').trim();
  const amount = normalizeAmount(amountValue, lineIdx, errors);

  if (amount === null) {
    // Only push generic parse error for string/number values that failed to parse.
    // Booleans get a specific type error from normalizeAmount; null/undefined
    // are silently skipped as "missing amount" indicators.
    if (
      typeof amountValue === 'string' || typeof amountValue === 'number'
    ) {
      errors.push(new ParseError(`금액을 해석할 수 없습니다: ${String(amountValue)}`, { line: lineIdx }));
    }
    return null;
  }
  // Skip zero and negative amounts (balance inquiries, refunds, credits).
  // Parity with CSV, HTML, XLSX, and OFX parsers (C26-COR02).
  if (amount <= 0) return null;

  const date = parseDateStringToISO(dateRaw);
  if (!isValidISODate(date) && dateRaw) {
    errors.push(new ParseError(`날짜를 해석할 수 없습니다: ${dateRaw}`, { line: lineIdx }));
  }

  const tx: RawTransaction = {
    date,
    merchant: String(merchantValue ?? '').trim(),
    amount,
  };

  const installValue = findField(obj, INSTALLMENTS_ALIASES);
  if (installValue !== undefined) {
    const inst = typeof installValue === 'number' ? installValue : parseInt(String(installValue), 10);
    if (!Number.isNaN(inst) && inst > 1) tx.installments = inst;
  }

  const categoryValue = findField(obj, CATEGORY_ALIASES);
  if (categoryValue !== undefined && String(categoryValue).trim()) {
    tx.category = String(categoryValue).trim();
  }

  const memoValue = findField(obj, MEMO_ALIASES);
  if (memoValue !== undefined && String(memoValue).trim()) {
    tx.memo = String(memoValue).trim();
  }

  return tx;
}

export function parseJSON(content: string, bank?: BankId): ParseResult {
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return {
      bank: bank ?? null,
      format: 'json',
      transactions: [],
      errors: [new ParseError(`JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`) ],
    };
  }

  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const wrapperKeys = ['transactions', 'data', 'items', 'records', 'results',
      'transactionList', 'transaction_list', '내역', '거래내역', 'list'];
    let found = false;
    for (const key of wrapperKeys) {
      if (Array.isArray(obj[key])) {
        items = obj[key] as unknown[];
        found = true;
        break;
      }
      const lower = key.toLowerCase();
      for (const objKey of Object.keys(obj)) {
        if (objKey.toLowerCase() === lower && Array.isArray(obj[objKey])) {
          items = obj[objKey] as unknown[];
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      return {
        bank: bank ?? null,
        format: 'json',
        transactions: [],
        errors: [new ParseError('JSON에서 거래 배열을 찾을 수 없습니다.')],
      };
    }
  } else {
    return {
      bank: bank ?? null,
      format: 'json',
      transactions: [],
      errors: [new ParseError('JSON 데이터 형식이 올바르지 않습니다.')],
    };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const tx = parseTransactionObject(item as Record<string, unknown>, i + 1, errors);
    if (tx) transactions.push(tx);
  }

  return { bank: bank ?? null, format: 'json', transactions, errors };
}