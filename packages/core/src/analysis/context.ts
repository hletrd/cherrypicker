import { addSafeNonnegativeIntegers } from '../numeric.js';

export type YearMonth = `${number}-${string}`;

export type PreviousSpendingBasis =
  | { kind: 'user-total'; amount: number }
  | { kind: 'statement-month'; month: YearMonth }
  | {
      kind: 'missing-calendar-month';
      month: YearMonth;
      assumedAmount: 0;
    };

export interface DatedAmount {
  date: string;
  amount: number;
}

export interface MonthlyBreakdown {
  month: YearMonth;
  spending: number;
  transactionCount: number;
}

export interface AnalysisContext<T extends DatedAmount> {
  validTransactions: T[];
  invalidDateTransactions: T[];
  latestMonth: YearMonth;
  latestTransactions: T[];
  previousTransactions: T[];
  previousSpendingBasis: PreviousSpendingBasis;
  statementPeriod?: { start: string; end: string };
  fullStatementPeriod?: { start: string; end: string };
  monthlyBreakdown: MonthlyBreakdown[];
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isYearMonth(value: string): value is YearMonth {
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function yearMonthOfDate(value: string): YearMonth | null {
  if (!isValidIsoDate(value)) return null;
  return value.slice(0, 7) as YearMonth;
}

export function previousCalendarMonth(month: YearMonth): YearMonth {
  if (!isYearMonth(month)) {
    throw new Error(`Invalid YearMonth: ${month}`);
  }
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (monthNumber === 1) {
    return `${year - 1}-12` as YearMonth;
  }
  return `${year}-${String(monthNumber - 1).padStart(2, '0')}` as YearMonth;
}

function dateRange<T extends DatedAmount>(
  transactions: readonly T[],
): { start: string; end: string } | undefined {
  if (transactions.length === 0) return undefined;
  const dates = transactions.map(({ date }) => date).sort();
  return { start: dates[0]!, end: dates.at(-1)! };
}

export function buildAnalysisContext<T extends DatedAmount>(
  transactions: readonly T[],
  explicitPreviousMonthSpending?: number,
): AnalysisContext<T> | null {
  if (
    explicitPreviousMonthSpending !== undefined &&
    (!Number.isFinite(explicitPreviousMonthSpending) ||
      !Number.isSafeInteger(explicitPreviousMonthSpending) ||
      explicitPreviousMonthSpending < 0)
  ) {
    throw new Error('previousMonthSpending must be a non-negative safe integer');
  }

  const validTransactions: T[] = [];
  const invalidDateTransactions: T[] = [];
  for (const transaction of transactions) {
    (isValidIsoDate(transaction.date)
      ? validTransactions
      : invalidDateTransactions
    ).push(transaction);
  }
  if (validTransactions.length === 0) return null;

  validTransactions.sort((left, right) => left.date.localeCompare(right.date));
  const latestMonth = yearMonthOfDate(validTransactions.at(-1)!.date)!;
  const latestTransactions = validTransactions.filter(
    ({ date }) => yearMonthOfDate(date) === latestMonth,
  );
  const previousMonth = previousCalendarMonth(latestMonth);
  const previousTransactions = validTransactions.filter(
    ({ date }) => yearMonthOfDate(date) === previousMonth,
  );

  const previousSpendingBasis: PreviousSpendingBasis =
    explicitPreviousMonthSpending !== undefined
      ? { kind: 'user-total', amount: explicitPreviousMonthSpending }
      : previousTransactions.length > 0
        ? { kind: 'statement-month', month: previousMonth }
        : {
            kind: 'missing-calendar-month',
            month: previousMonth,
            assumedAmount: 0,
          };

  const monthly = new Map<
    YearMonth,
    { spending: number; transactionCount: number }
  >();
  for (const transaction of validTransactions) {
    const month = yearMonthOfDate(transaction.date)!;
    const current = monthly.get(month) ?? { spending: 0, transactionCount: 0 };
    if (transaction.amount > 0) {
      current.spending = addSafeNonnegativeIntegers(
        current.spending,
        transaction.amount,
        `monthly spending for ${month}`,
      );
    }
    current.transactionCount += 1;
    monthly.set(month, current);
  }
  const monthlyBreakdown = [...monthly]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => ({ month, ...values }));

  return {
    validTransactions,
    invalidDateTransactions,
    latestMonth,
    latestTransactions,
    previousTransactions,
    previousSpendingBasis,
    statementPeriod: dateRange(latestTransactions),
    fullStatementPeriod: dateRange(validTransactions),
    monthlyBreakdown,
  };
}
