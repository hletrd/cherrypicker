/** JSON transaction parser.
 *  Parses JSON arrays of transaction objects from banking APIs, mobile app
 *  exports, and financial tools. Supports various field name conventions
 *  used by Korean and international banking services (C97-01). */

import type { BankId, ParseResult, RawTransaction, ParseError } from '../types.js';
import { parseCSVAmount } from '../csv/shared.js';
import { parseDateStringToISO, isValidISODate } from '../date-utils.js';

/** Field name aliases for date, merchant, and amount fields.
 *  Maps common variations (Korean + English) to canonical field names.
 *  Used for flexible field matching in JSON transaction objects (C97-01). */
const DATE_ALIASES = [
  'date', 'transactionDate', 'transaction_date', 'transDate', 'trans_date',
  'purchaseDate', 'purchase_date', 'orderDate', 'order_date', 'bookDate',
  'book_date', 'posted', 'postedDate', 'posted_date', 'billing', 'billingDate',
  'billing_date', 'settlementDate', 'settlement_date', 'paymentDate', 'payment_date',
  'timestamp', 'txnDate', 'txn_date', 'transDt', 'trans_dt',
  // Korean aliases
  '이용일', '이용일자', '거래일', '거래일시', '날짜', '결제일', '승인일',
  '승인일자', '매출일', '작성일', '사용일', '처리일', '주문일', '입금일',
];

const MERCHANT_ALIASES = [
  'merchant', 'store', 'shop', 'vendor', 'description', 'desc', 'item',
  'name', 'payee', 'seller', 'company', 'business', 'recipient', 'outlet',
  'supplier', 'brand', 'location', 'details', 'reference', 'transaction',
  'merchantName', 'merchant_name', 'storeName', 'store_name',
  // Korean aliases
  '이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처',
  '결제처', '상호', '판매처', '구매처', '매장', '이용내용', '거래내용',
  '상호명', '업체명', '판매자', '거래내역', '상점',
];

const AMOUNT_ALIASES = [
  'amount', 'amt', 'total', 'price', 'won', 'charge', 'payment', 'paid',
  'spent', 'cost', 'value', 'debit', 'credit', 'net', 'netAmount', 'net_amount',
  'gross', 'transactionAmount', 'transaction_amount', 'paymentAmount', 'payment_amount',
  'billedAmount', 'billed_amount', 'totalAmount', 'total_amount',
  // Korean aliases
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
  'memo', 'note', 'notes', 'remarks', 'remark', 'description' /* fallback */,
  '비고', '적요', '메모', '내용', '설명', '참고', '상세내역', '승인번호',
];

/** Find the first matching field name from a set of aliases in an object.
 *  Returns the value if found, undefined otherwise. */
function findField(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (alias in obj) return obj[alias];
    // Case-insensitive fallback for English aliases
    const lower = alias.toLowerCase();
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === lower) return obj[key];
    }
  }
  return undefined;
}

/** Normalize an amount value from JSON. Handles:
 *  - Numbers (rounded to integer Won)
 *  - Strings with various formats (commas, Won sign, KRW prefix, etc.)
 *  Returns null for unparseable values. */
function normalizeAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw) : null;
  }
  if (typeof raw === 'string') {
    return parseCSVAmount(raw);
  }
  return null;
}

/** Parse a single JSON object as a transaction. Returns null if the object
 *  doesn't have sufficient fields (date + amount at minimum). */
function parseTransactionObject(
  obj: Record<string, unknown>,
  lineIdx: number,
  errors: ParseError[],
): RawTransaction | null {
  const dateValue = findField(obj, DATE_ALIASES);
  const amountValue = findField(obj, AMOUNT_ALIASES);
  const merchantValue = findField(obj, MERCHANT_ALIASES);

  // Need at least date and amount
  if (dateValue === undefined || amountValue === undefined) return null;

  const dateRaw = String(dateValue ?? '').trim();
  const amount = normalizeAmount(amountValue);

  if (amount === null || amount <= 0) {
    if (amount === null && String(amountValue).trim()) {
      errors.push({ line: lineIdx, message: `금액을 해석할 수 없습니다: ${String(amountValue)}` });
    }
    return null;
  }

  const date = parseDateStringToISO(dateRaw);
  if (!isValidISODate(date) && dateRaw) {
    errors.push({ line: lineIdx, message: `날짜를 해석할 수 없습니다: ${dateRaw}` });
  }

  const tx: RawTransaction = {
    date,
    merchant: String(merchantValue ?? '').trim(),
    amount,
  };

  // Optional fields
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

/** Parse a JSON string containing transaction data.
 *  Supports:
 *  - Direct array of transaction objects: [{ date, merchant, amount }, ...]
 *  - Wrapped format: { transactions: [...] } or { data: [...] }
 *  - Various field name conventions (Korean + English aliases)
 *
 *  Returns ParseResult with transactions and any errors encountered (C97-01). */
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
      errors: [{ message: `JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }

  // Extract array from wrapped formats
  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    // Try common wrapper keys
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
      // Case-insensitive fallback
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
        errors: [{ message: 'JSON에서 거래 배열을 찾을 수 없습니다.' }],
      };
    }
  } else {
    return {
      bank: bank ?? null,
      format: 'json',
      transactions: [],
      errors: [{ message: 'JSON 데이터 형식이 올바르지 않습니다.' }],
    };
  }

  // Parse each item as a transaction
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const tx = parseTransactionObject(item as Record<string, unknown>, i + 1, errors);
    if (tx) transactions.push(tx);
  }

  return { bank: bank ?? null, format: 'json', transactions, errors };
}