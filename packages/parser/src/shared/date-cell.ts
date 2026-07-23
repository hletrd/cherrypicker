import xlsx from 'xlsx';
import {
  isValidDayForMonth,
  isValidISODate,
  parseDateStringToISO,
} from '../date-utils.js';

export interface DateCellResult {
  value: string;
  error?: string;
}

const EXCEL_ERROR_PATTERN = /^#(VALUE!|REF!|DIV\/0!|NAME\?|NULL!|NUM!|CALC!|N\/A)$/i;

function invalid(raw: unknown): DateCellResult {
  const value = String(raw ?? '').trim();
  return {
    value,
    ...(value ? { error: `날짜를 해석할 수 없습니다: ${value}` } : {}),
  };
}

/** Coerce SheetJS cells without converting Date objects through locale text. */
export function parseDateCell(raw: unknown): DateCellResult {
  if (typeof raw === 'string' && EXCEL_ERROR_PATTERN.test(raw.trim())) {
    return { value: raw.trim(), error: `셀 수식 오류: ${raw.trim()}` };
  }

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return invalid(raw);
    const year = raw.getFullYear().toString().padStart(4, '0');
    const month = (raw.getMonth() + 1).toString().padStart(2, '0');
    const day = raw.getDate().toString().padStart(2, '0');
    return { value: `${year}-${month}-${day}` };
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return invalid(raw);

    const whole = Math.trunc(raw);
    const compact = whole.toString();
    if (raw === whole && compact.length === 8) {
      const parsed = parseDateStringToISO(compact);
      if (isValidISODate(parsed)) return { value: parsed };
    }
    if (raw === whole && compact.length === 6) {
      const parsed = parseDateStringToISO(compact);
      if (isValidISODate(parsed)) return { value: parsed };
    }

    if (raw < 1 || raw > 100000) return invalid(raw);
    const date = xlsx.SSF.parse_date_code(raw);
    if (
      date
      && date.m >= 1
      && date.m <= 12
      && isValidDayForMonth(date.y, date.m, date.d)
    ) {
      return {
        value: `${date.y.toString().padStart(4, '0')}-${date.m
          .toString()
          .padStart(2, '0')}-${date.d.toString().padStart(2, '0')}`,
      };
    }
    return invalid(raw);
  }

  if (typeof raw === 'string') {
    const value = parseDateStringToISO(raw);
    return isValidISODate(value) || !raw.trim()
      ? { value }
      : { value, error: `날짜를 해석할 수 없습니다: ${raw.trim()}` };
  }

  return invalid(raw);
}
