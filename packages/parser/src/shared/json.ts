import { isValidISODate, parseDateStringToISO } from '../date-utils.js';
import { parseAmount } from './amount.js';
import {
  normalizeRequiredMerchant,
  REQUIRED_MERCHANT_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_MESSAGE,
} from './required-fields.js';
import {
  AMBIGUOUS_AMOUNT_ERROR_CODE,
  AMBIGUOUS_AMOUNT_MESSAGE,
  compileAmountFieldPlan,
  NON_SPENDING_AMOUNT_ERROR_CODE,
  nonSpendingAmountMessage,
  normalizeResolvedSpendingAmount,
  resolveAmountField,
} from './amount-fields.js';
import {
  extractTransactionFacts,
  type ParsedTransactionFacts,
} from './transaction-facts.js';

const DATE_ALIASES = [
  'date', 'transactionDate', 'transaction_date', 'transDate', 'trans_date',
  'purchaseDate', 'purchase_date', 'orderDate', 'order_date', 'bookDate',
  'book_date', 'posted', 'postedDate', 'posted_date', 'billing', 'billingDate',
  'billing_date', 'settlementDate', 'settlement_date', 'paymentDate', 'payment_date',
  'timestamp', 'txnDate', 'txn_date', 'transDt', 'trans_dt',
  '이용일', '이용일자', '거래일', '거래일시', '날짜', '결제일', '승인일',
  '승인일자', '매출일', '작성일', '사용일', '처리일', '주문일', '입금일',
] as const;

const MERCHANT_ALIASES = [
  'merchant', 'store', 'shop', 'vendor', 'description', 'desc', 'item',
  'name', 'payee', 'seller', 'company', 'business', 'recipient', 'outlet',
  'supplier', 'brand', 'location', 'details', 'reference', 'transaction',
  'merchantName', 'merchant_name', 'storeName', 'store_name',
  '이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처',
  '결제처', '상호', '판매처', '구매처', '매장', '이용내용', '거래내용',
  '상호명', '업체명', '판매자', '거래내역', '상점',
] as const;

const INSTALLMENTS_ALIASES = [
  'installments', 'install', 'installment', 'installmentCount', 'installment_count',
  '할부', '할부개월', '할부기간',
] as const;

const CATEGORY_ALIASES = [
  'category', 'type',
  '업종', '카테고리', '분류', '업종분류', '거래유형', '결제유형', '결제구분', '구분',
] as const;

const MEMO_ALIASES = [
  'memo', 'note', 'notes', 'remarks', 'remark',
  // Merchant aliases take precedence, so description is only a fallback when
  // the canonical merchant field set changes.
  'description',
  '비고', '적요', '메모', '내용', '설명', '참고', '상세내역', '승인번호',
] as const;

const WRAPPER_KEYS = [
  'transactions', 'data', 'items', 'records', 'results',
  'transactionList', 'transaction_list', '내역', '거래내역', 'list',
] as const;

export interface JSONTransaction extends ParsedTransactionFacts {
  date: string;
  merchant: string;
  amount: number;
  installments?: number;
  category?: string;
  memo?: string;
}

export interface JSONParseDiagnostic {
  message: string;
  code:
    | 'json_syntax'
    | 'json_shape'
    | 'json_row_rejected'
    | 'json_fact_invalid'
    | 'json_diagnostics_omitted'
    | typeof NON_SPENDING_AMOUNT_ERROR_CODE
    | typeof AMBIGUOUS_AMOUNT_ERROR_CODE
    | typeof REQUIRED_MERCHANT_ERROR_CODE;
  line?: number;
  count?: number;
}

export interface JSONParseKernelResult {
  transactions: JSONTransaction[];
  errors: JSONParseDiagnostic[];
}

function findField(
  object: Readonly<Record<string, unknown>>,
  aliases: readonly string[],
): unknown {
  for (const alias of aliases) {
    if (Object.hasOwn(object, alias)) return object[alias];
  }

  const lowerFields = new Map(
    Object.entries(object).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const alias of aliases) {
    if (lowerFields.has(alias.toLowerCase())) {
      return lowerFields.get(alias.toLowerCase());
    }
  }
  return undefined;
}

function rejectedRow(line: number, message: string): JSONParseDiagnostic {
  return { code: 'json_row_rejected', line, message };
}

export const MAX_JSON_PARSE_DIAGNOSTICS = 100;

function diagnosticCount(diagnostic: JSONParseDiagnostic): number {
  return Number.isSafeInteger(diagnostic.count)
    && diagnostic.count !== undefined
    && diagnostic.count > 0
    ? diagnostic.count
    : 1;
}

class JSONDiagnosticCollector {
  readonly errors: JSONParseDiagnostic[] = [];

  add(diagnostic: JSONParseDiagnostic): void {
    if (this.errors.length < MAX_JSON_PARSE_DIAGNOSTICS) {
      this.errors.push(diagnostic);
      return;
    }

    const currentSummary = this.errors.at(-1);
    if (currentSummary?.code === 'json_diagnostics_omitted') {
      currentSummary.count = Math.min(
        Number.MAX_SAFE_INTEGER,
        diagnosticCount(currentSummary) + diagnosticCount(diagnostic),
      );
      return;
    }

    const displaced = this.errors.pop();
    this.errors.push({
      code: 'json_diagnostics_omitted',
      message: '나머지 JSON 파싱 경고를 요약했어요.',
      count: Math.min(
        Number.MAX_SAFE_INTEGER,
        diagnosticCount(displaced ?? diagnostic) + diagnosticCount(diagnostic),
      ),
    });
  }
}

function parseTransactionObject(
  object: Readonly<Record<string, unknown>>,
  line: number,
  diagnostics: JSONDiagnosticCollector,
): JSONTransaction | null {
  const dateValue = findField(object, DATE_ALIASES);
  const merchantValue = findField(object, MERCHANT_ALIASES);
  const merchant = normalizeRequiredMerchant(merchantValue);

  if (!merchant) {
    diagnostics.add({
      code: REQUIRED_MERCHANT_ERROR_CODE,
      line,
      message: REQUIRED_MERCHANT_ERROR_MESSAGE,
    });
    return null;
  }

  const amountKeys = Object.keys(object);
  const amountPlan = compileAmountFieldPlan(amountKeys);
  const amountResolution = resolveAmountField(
    amountPlan,
    (index) => object[amountKeys[index]!],
  );
  if (amountResolution.kind === 'non-spending') {
    diagnostics.add({
      code: NON_SPENDING_AMOUNT_ERROR_CODE,
      line,
      message: nonSpendingAmountMessage(merchant, amountResolution.raw),
    });
    return null;
  }
  if (amountResolution.kind === 'ambiguous') {
    diagnostics.add({
      code: AMBIGUOUS_AMOUNT_ERROR_CODE,
      line,
      message: AMBIGUOUS_AMOUNT_MESSAGE,
    });
    return null;
  }
  const amountValue = amountResolution.kind === 'spending'
    ? amountResolution.raw
    : undefined;

  const missingFields: string[] = [];
  if (dateValue === undefined || dateValue === null || String(dateValue).trim() === '') {
    missingFields.push('date');
  }
  if (amountValue === undefined || amountValue === null) {
    missingFields.push('amount');
  }
  if (missingFields.length > 0) {
    diagnostics.add(rejectedRow(
      line,
      `필수 거래 필드가 없습니다: ${missingFields.join(', ')}`,
    ));
    return null;
  }

  const parsedAmount = parseAmount(amountValue);
  if (parsedAmount === null) {
    const type =
      typeof amountValue === 'number' || typeof amountValue === 'string'
        ? ''
        : ` (${typeof amountValue})`;
    diagnostics.add(rejectedRow(
      line,
      `금액을 해석할 수 없습니다${type}: ${String(amountValue)}`,
    ));
    return null;
  }
  const amount = amountResolution.kind === 'spending'
    ? normalizeResolvedSpendingAmount(parsedAmount, amountResolution.role)
    : parsedAmount;
  if (amount <= 0) {
    diagnostics.add(rejectedRow(
      line,
      `지출로 처리되지 않는 금액입니다: ${String(merchantValue ?? '').trim()} ${amount}원`,
    ));
    return null;
  }

  const dateRaw = String(dateValue).trim();
  const date = parseDateStringToISO(dateRaw);
  if (!isValidISODate(date)) {
    diagnostics.add(rejectedRow(line, `날짜를 해석할 수 없습니다: ${dateRaw}`));
    return null;
  }

  const extractedFacts = extractTransactionFacts(object);
  for (const message of extractedFacts.errors) {
    diagnostics.add({ code: 'json_fact_invalid', line, message });
  }

  const transaction: JSONTransaction = {
    date,
    merchant,
    amount,
    ...extractedFacts.facts,
  };

  const installmentsValue = findField(object, INSTALLMENTS_ALIASES);
  if (installmentsValue !== undefined) {
    const installments =
      typeof installmentsValue === 'number'
        ? installmentsValue
        : Number.parseInt(String(installmentsValue), 10);
    if (Number.isSafeInteger(installments) && installments > 1) {
      transaction.installments = installments;
    }
  }

  const categoryValue = findField(object, CATEGORY_ALIASES);
  if (categoryValue !== undefined && String(categoryValue).trim()) {
    transaction.category = String(categoryValue).trim();
  }

  const memoValue = findField(object, MEMO_ALIASES);
  if (memoValue !== undefined && String(memoValue).trim()) {
    transaction.memo = String(memoValue).trim();
  }

  return transaction;
}

function selectTransactionRows(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return null;

  const object = parsed as Record<string, unknown>;
  for (const key of WRAPPER_KEYS) {
    if (Array.isArray(object[key])) return object[key];
    const matchedKey = Object.keys(object).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );
    if (matchedKey && Array.isArray(object[matchedKey])) {
      return object[matchedKey];
    }
  }
  return null;
}

/**
 * Browser-safe JSON grammar shared by the package and web adapters.
 *
 * Once an array is selected, each row produces either one accepted
 * transaction or one `json_row_rejected` diagnostic. Accepted rows may also
 * carry bounded fact diagnostics when optional statement facts are invalid.
 */
export function parseJSONTransactions(content: string): JSONParseKernelResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      transactions: [],
      errors: [{
        code: 'json_syntax',
        message: `JSON 파싱 실패: ${error instanceof Error ? error.message : String(error)}`,
      }],
    };
  }

  const rows = selectTransactionRows(parsed);
  if (!rows) {
    return {
      transactions: [],
      errors: [{
        code: 'json_shape',
        message:
          parsed && typeof parsed === 'object'
            ? 'JSON에서 거래 배열을 찾을 수 없습니다.'
            : 'JSON 데이터 형식이 올바르지 않습니다.',
      }],
    };
  }

  const transactions: JSONTransaction[] = [];
  const diagnostics = new JSONDiagnosticCollector();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 1;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      diagnostics.add(rejectedRow(line, '거래 행이 객체 형식이 아닙니다.'));
      continue;
    }
    const transaction = parseTransactionObject(
      row as Record<string, unknown>,
      line,
      diagnostics,
    );
    if (transaction) transactions.push(transaction);
  }

  return { transactions, errors: diagnostics.errors };
}
