import {
  buildAnalysisContext,
  isValidIsoDate,
  yearMonthOfDate,
} from './analysis-context.js';

interface DatedTransaction {
  date: string;
  amount: number;
}

export interface ParseWarning {
  fileName: string;
  format: string;
  line?: number;
  message: string;
  raw?: string;
  count?: number;
}

export function getLatestMonth(
  transactions: readonly DatedTransaction[],
): string | null {
  const validMonths = transactions
    .map(({ date }) => yearMonthOfDate(date))
    .filter((month): month is NonNullable<typeof month> => month !== null);
  return validMonths.sort().at(-1) ?? null;
}

export function buildMonthlyBreakdown(
  transactions: readonly DatedTransaction[],
): Array<{ month: string; spending: number; transactionCount: number }> {
  return buildAnalysisContext(transactions)?.monthlyBreakdown ?? [];
}

export function validDateRange(
  transactions: readonly DatedTransaction[],
): { start: string; end: string } | undefined {
  const dates = transactions
    .map(({ date }) => date)
    .filter(isValidIsoDate)
    .sort();
  if (dates.length === 0) return undefined;
  return { start: dates[0]!, end: dates.at(-1)! };
}

export function attachParseWarningIdentity(
  errors: readonly { line?: number; message: string; raw?: string; count?: number }[],
  fileName: string,
  format: string,
): ParseWarning[] {
  return errors.map((error) => ({
    fileName,
    format,
    ...error,
  }));
}

export function emptyParseResultMessage(
  errors: readonly { message: string }[],
): string {
  const actionable = errors.find(({ message }) => message.trim().length > 0);
  return actionable?.message ?? '거래 내역을 찾을 수 없어요';
}

export function assertRequestedCardsResolved(
  requestedCardIds: readonly string[] | undefined,
  resolvedCount: number,
): void {
  if (requestedCardIds && requestedCardIds.length > 0 && resolvedCount === 0) {
    throw new Error('선택한 카드 정보를 찾을 수 없어요. 카드를 다시 선택해 주세요.');
  }
}

export function assertCatalogAvailable(resolvedCount: number): void {
  if (resolvedCount === 0) {
    throw new Error('카드 혜택 데이터를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.');
  }
}
