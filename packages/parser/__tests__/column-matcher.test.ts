import { describe, it, expect } from 'bun:test';
import {
  normalizeHeader,
  findColumn,
  isValidHeaderRow,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  SUMMARY_ROW_PATTERN,
  HEADER_KEYWORDS,
  DATE_KEYWORDS,
  MERCHANT_KEYWORDS,
  AMOUNT_KEYWORDS,
  CATEGORY_KEYWORDS,
  MEMO_KEYWORDS,
} from '../src/csv/column-matcher';

// ---------------------------------------------------------------------------
// normalizeHeader
// ---------------------------------------------------------------------------
describe('normalizeHeader', () => {
  it('trims whitespace', () => {
    expect(normalizeHeader('  이용일  ')).toBe('이용일');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeHeader('이용 금액')).toBe('이용금액');
  });

  it('removes parenthetical suffixes', () => {
    expect(normalizeHeader('이용금액(원)')).toBe('이용금액');
    expect(normalizeHeader('거래금액(Won)')).toBe('거래금액');
  });

  it('strips zero-width spaces (U+200B)', () => {
    expect(normalizeHeader('이​용​일')).toBe('이용일');
  });

  it('strips zero-width non-joiners (U+200C)', () => {
    expect(normalizeHeader('이‌용‌일')).toBe('이용일');
  });

  it('strips zero-width joiners (U+200D)', () => {
    expect(normalizeHeader('이‍용‍일')).toBe('이용일');
  });

  it('strips soft hyphens (U+00AD)', () => {
    expect(normalizeHeader('이­용­일')).toBe('이용일');
  });

  it('handles empty string', () => {
    expect(normalizeHeader('')).toBe('');
  });

  it('handles combination of issues', () => {
    expect(normalizeHeader('  이​용  금액(원)  ')).toBe('이용금액');
  });

  it('strips tab characters (U+0009)', () => {
    expect(normalizeHeader('이용\t일')).toBe('이용일');
    expect(normalizeHeader('\t이용금액\t')).toBe('이용금액');
  });

  it('strips newline characters (U+000A, U+000D)', () => {
    expect(normalizeHeader('이용\n일')).toBe('이용일');
    expect(normalizeHeader('이용\r\n금액')).toBe('이용금액');
  });

  it('strips mixed invisible and whitespace characters', () => {
    expect(normalizeHeader('  이\t용\n 금액(원)  ')).toBe('이용금액');
  });

  it('strips no-break spaces (U+00A0)', () => {
    // NBSP commonly appears in Korean bank exports copied from web pages
    expect(normalizeHeader('이용 금액')).toBe('이용금액');
    expect(normalizeHeader(' 이용일 ')).toBe('이용일');
    expect(normalizeHeader('이용  일')).toBe('이용일');
  });
});

// ---------------------------------------------------------------------------
// findColumn
// ---------------------------------------------------------------------------
describe('findColumn', () => {
  const headers = ['이용일', '이용처', '이용금액', '할부', '비고'];

  it('finds column by exact name', () => {
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, '이용처', MERCHANT_COLUMN_PATTERN)).toBe(1);
    expect(findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('finds column by regex when exact name does not match', () => {
    // '거래일' is not in headers but matches DATE_COLUMN_PATTERN
    expect(findColumn(headers, '거래일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('returns -1 when neither exact nor regex matches', () => {
    expect(findColumn(headers, 'nonexistent', CATEGORY_COLUMN_PATTERN)).toBe(-1);
  });

  it('prefers exact match over regex', () => {
    const mixed = ['날짜', '이용일', '거래일'];
    // '이용일' exact match should find index 1
    expect(findColumn(mixed, '이용일', DATE_COLUMN_PATTERN)).toBe(1);
  });

  it('handles undefined exactName by falling back to regex', () => {
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('handles empty headers array', () => {
    expect(findColumn([], '이용일', DATE_COLUMN_PATTERN)).toBe(-1);
  });

  it('normalizes headers before matching', () => {
    const spaced = ['이용 일', '이용 처', '이용 금액'];
    expect(findColumn(spaced, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(spaced, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('handles parenthetical suffixes in headers', () => {
    const withSuffixes = ['이용일', '이용처', '이용금액(원)'];
    expect(findColumn(withSuffixes, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('matches English column names case-insensitively', () => {
    const english = ['Date', 'Merchant', 'Amount'];
    expect(findColumn(english, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(english, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
    expect(findColumn(english, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isValidHeaderRow
// ---------------------------------------------------------------------------
describe('isValidHeaderRow', () => {
  it('accepts a standard Korean header row', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '이용금액'])).toBe(true);
  });

  it('accepts a row with bank-specific column names', () => {
    expect(isValidHeaderRow(['거래일시', '가맹점명', '이용금액', '할부개월', '업종'])).toBe(true);
  });

  it('rejects a row with only amount keywords (summary row)', () => {
    expect(isValidHeaderRow(['이용금액', '거래금액', '합계'])).toBe(false);
  });

  it('rejects approval total summary row as header (C25)', () => {
    expect(isValidHeaderRow(['승인합계', '100,000'])).toBe(false);
    expect(isValidHeaderRow(['결제합계', '50,000'])).toBe(false);
  });

  it('rejects total usage summary row as header (C25)', () => {
    expect(isValidHeaderRow(['총사용', '200,000'])).toBe(false);
    expect(isValidHeaderRow(['총이용', '200,000'])).toBe(false);
  });

  it('rejects a row with only date keywords', () => {
    expect(isValidHeaderRow(['이용일', '거래일', '날짜'])).toBe(false);
  });

  it('rejects a row with no header keywords', () => {
    expect(isValidHeaderRow(['2024-01-15', '스타벅스', '5000'])).toBe(false);
  });

  it('accepts English header keywords', () => {
    expect(isValidHeaderRow(['Date', 'Merchant', 'Amount'])).toBe(true);
  });

  it('accepts mixed Korean and English', () => {
    expect(isValidHeaderRow(['이용일', 'Merchant', 'Amount'])).toBe(true);
  });

  it('requires at least 2 distinct categories', () => {
    // Only date + merchant = 2 categories (should pass)
    expect(isValidHeaderRow(['이용일', '이용처'])).toBe(true);
    // Only date = 1 category (should fail)
    expect(isValidHeaderRow(['이용일', '거래일', '날짜'])).toBe(false);
    // Date + memo = 2 categories (should pass with expanded memo keywords)
    expect(isValidHeaderRow(['이용일', '비고', '메모'])).toBe(true);
  });

  it('handles empty row', () => {
    expect(isValidHeaderRow([])).toBe(false);
  });

  it('normalizes headers before matching', () => {
    expect(isValidHeaderRow(['이용 일', '이용 처', '이용 금액'])).toBe(true);
  });

  it('handles parenthetical suffixes', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '이용금액(원)'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Column pattern constants
// ---------------------------------------------------------------------------
describe('DATE_COLUMN_PATTERN', () => {
  const shouldMatch = ['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '승인일자', '매출일', '작성일', 'date', 'Date', 'transaction_date', 'trans_date'];
  const shouldNotMatch = ['이용처', '금액', '할부', '스타벅스'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(DATE_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(DATE_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('MERCHANT_COLUMN_PATTERN', () => {
  const shouldMatch = ['이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호', '판매처', '구매처', '매장', '취급처', 'merchant', 'Merchant', 'store', 'description', 'vendor', 'item'];
  const shouldNotMatch = ['이용일', '금액', '할부', '날짜'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(MERCHANT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(MERCHANT_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('AMOUNT_COLUMN_PATTERN', () => {
  const shouldMatch = ['이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액', 'amount', 'Amount', 'total'];
  const shouldNotMatch = ['이용일', '이용처', '할부', '날짜'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(AMOUNT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(AMOUNT_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('INSTALLMENTS_COLUMN_PATTERN', () => {
  const shouldMatch = ['할부', '할부개월', '할부기간', '할부월', '할부개월수', 'installment', 'installments'];
  const shouldNotMatch = ['이용일', '금액', '이용처'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(INSTALLMENTS_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(INSTALLMENTS_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('CATEGORY_COLUMN_PATTERN', () => {
  const shouldMatch = ['업종', '카테고리', '분류', '업종분류', '업종명', 'category', 'type'];
  const shouldNotMatch = ['이용일', '금액', '이용처'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(CATEGORY_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(CATEGORY_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('MEMO_COLUMN_PATTERN', () => {
  const shouldMatch = ['비고', '적요', '메모', '내용', '설명', '참고', 'memo', 'note', 'remark', 'remarks'];
  const shouldNotMatch = ['이용일', '금액', '이용처'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(MEMO_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(MEMO_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Keyword Sets
// ---------------------------------------------------------------------------
describe('HEADER_KEYWORDS', () => {
  it('contains Korean date keywords', () => {
    expect(HEADER_KEYWORDS).toContain('이용일');
    expect(HEADER_KEYWORDS).toContain('거래일');
  });

  it('contains Korean merchant keywords', () => {
    expect(HEADER_KEYWORDS).toContain('이용처');
    expect(HEADER_KEYWORDS).toContain('가맹점');
  });

  it('contains Korean amount keywords', () => {
    expect(HEADER_KEYWORDS).toContain('이용금액');
    expect(HEADER_KEYWORDS).toContain('거래금액');
  });

  it('contains English keywords', () => {
    expect(HEADER_KEYWORDS).toContain('date');
    expect(HEADER_KEYWORDS).toContain('merchant');
    expect(HEADER_KEYWORDS).toContain('amount');
  });
});

describe('Keyword category Sets', () => {
  it('DATE_KEYWORDS contains expected entries', () => {
    expect(DATE_KEYWORDS.has('이용일')).toBe(true);
    expect(DATE_KEYWORDS.has('date')).toBe(true);
    expect(DATE_KEYWORDS.has('이용처')).toBe(false);
  });

  it('MERCHANT_KEYWORDS contains expected entries', () => {
    expect(MERCHANT_KEYWORDS.has('이용처')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('merchant')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('이용일')).toBe(false);
  });

  it('AMOUNT_KEYWORDS contains expected entries', () => {
    expect(AMOUNT_KEYWORDS.has('이용금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('amount')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('이용일')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SUMMARY_ROW_PATTERN
// ---------------------------------------------------------------------------
describe('SUMMARY_ROW_PATTERN', () => {
  it('matches Korean summary variants', () => {
    const variants = ['총 합계', '합 계', '총 계', '소 계', '합계', '총계', '소계', '누계', '잔액', '당월', '명세'];
    for (const v of variants) {
      expect(SUMMARY_ROW_PATTERN.test(v)).toBe(true);
    }
  });

  it('matches English summary variants', () => {
    expect(SUMMARY_ROW_PATTERN.test('total')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('Total')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('sum')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('SUM')).toBe(true);
  });

  it('matches summary text within longer strings', () => {
    expect(SUMMARY_ROW_PATTERN.test('총 합계 100,000원')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('2026-02-01 합계 50,000')).toBe(true);
  });

  it('does not match normal transaction text', () => {
    expect(SUMMARY_ROW_PATTERN.test('스타벅스 강남점')).toBe(false);
    expect(SUMMARY_ROW_PATTERN.test('이마트 서초점')).toBe(false);
    expect(SUMMARY_ROW_PATTERN.test('2026-02-01')).toBe(false);
  });

  it('matches approval/payment total variants (C24)', () => {
    expect(SUMMARY_ROW_PATTERN.test('승인 합계')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('승인합계')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('결제 합계')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('결제합계')).toBe(true);
  });

  it('matches total usage variants (C24)', () => {
    expect(SUMMARY_ROW_PATTERN.test('총 사용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총사용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총 이용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총이용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총 사용 100,000원')).toBe(true);
  });

  it('matches summary keywords followed by CSV delimiters (C30-01)', () => {
    expect(SUMMARY_ROW_PATTERN.test('합계,,,,123456')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총 합계,,,,123456')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('합계;123456')).toBe(true);
  });

  it('does not match merchant names containing summary keywords (C30-01)', () => {
    // "합계마트" — "합계" is followed by Korean text, not a boundary
    expect(SUMMARY_ROW_PATTERN.test('합계마트')).toBe(false);
    // "소비마트" — "소비" removed from pattern entirely
    expect(SUMMARY_ROW_PATTERN.test('소비마트')).toBe(false);
    // "합계부" — "합계" followed by Korean character
    expect(SUMMARY_ROW_PATTERN.test('합계부')).toBe(false);
    // Embedded in a CSV line with merchant name
    expect(SUMMARY_ROW_PATTERN.test('2024-01-15,합계마트,5000')).toBe(false);
    expect(SUMMARY_ROW_PATTERN.test('2024-01-15,소비마트,5000')).toBe(false);
  });

  it('still matches summary keywords at line start followed by delimiters (C30-01)', () => {
    // "합계" at line start followed by commas (typical CSV summary row)
    expect(SUMMARY_ROW_PATTERN.test('합계,,,,123456')).toBe(true);
    // "합계" preceded by non-Korean text and followed by delimiter
    expect(SUMMARY_ROW_PATTERN.test('2024-01-15,합계,,123456')).toBe(true);
  });

  it('matches 합산 (subtotal/aggregate) variant', () => {
    expect(SUMMARY_ROW_PATTERN.test('합산')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('합산 1,000,000원')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('합산,,,,123456')).toBe(true);
  });

  it('does not false-positive on merchant names containing 합산', () => {
    expect(SUMMARY_ROW_PATTERN.test('합산마트')).toBe(false);
    expect(SUMMARY_ROW_PATTERN.test('합산부')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidHeaderRow edge cases — summary rows with date-like content (C26)
// ---------------------------------------------------------------------------
describe('isValidHeaderRow rejects summary rows with date context (C26)', () => {
  it('rejects row with date-format string and summary keyword', () => {
    // A summary row that happens to contain a date-like value should not
    // be recognized as a header — it only has amount-category keywords.
    expect(isValidHeaderRow(['2024-01-15', '합계', '50000'])).toBe(false);
  });

  it('rejects row with short date and approval total keyword', () => {
    expect(isValidHeaderRow(['01/15', '승인합계', '100,000'])).toBe(false);
  });

  it('rejects row with total usage and numeric data', () => {
    expect(isValidHeaderRow(['총사용', '200,000', '1234'])).toBe(false);
  });

  it('rejects row with English total and date-like content', () => {
    expect(isValidHeaderRow(['total', '50,000', '20240115'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Keyword Set completeness — catch drift between Sets and regex patterns
// ---------------------------------------------------------------------------
describe('Keyword Set completeness (C24)', () => {
  it('isValidHeaderRow accepts English-only headers via regex-matched keywords', () => {
    // Date + Shop + Price: Date matches DATE_KEYWORDS, Shop matches
    // MERCHANT_KEYWORDS, Price matches AMOUNT_KEYWORDS (all must be in Sets)
    expect(isValidHeaderRow(['Date', 'Shop', 'Price'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Store', 'Amount'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Merchant', 'Total'])).toBe(true);
    expect(isValidHeaderRow(['date', 'shop', 'won'])).toBe(true);
  });

  it('isValidHeaderRow accepts headers with all regex-matched English terms', () => {
    // These terms are only matched by column regex patterns, not by exact
    // HEADER_KEYWORDS list. They MUST be in the category Sets.
    expect(isValidHeaderRow(['Date', 'Description', 'Price'])).toBe(true);
    expect(isValidHeaderRow(['date', 'store', 'total'])).toBe(true);
  });

  it('AMOUNT_KEYWORDS contains all regex-matched English alternatives', () => {
    expect(AMOUNT_KEYWORDS.has('price')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('won')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('amount')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('total')).toBe(true);
  });

  it('MERCHANT_KEYWORDS contains all regex-matched English alternatives', () => {
    expect(MERCHANT_KEYWORDS.has('shop')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('store')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('merchant')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('description')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('vendor')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('item')).toBe(true);
  });

  it('DATE_KEYWORDS contains expanded Korean terms', () => {
    expect(DATE_KEYWORDS.has('작성일')).toBe(true);
    expect(DATE_KEYWORDS.has('승인일')).toBe(true);
    expect(DATE_KEYWORDS.has('매출일')).toBe(true);
  });

  it('MERCHANT_KEYWORDS contains expanded Korean terms', () => {
    expect(MERCHANT_KEYWORDS.has('판매처')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('구매처')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('매장')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('취급처')).toBe(true);
  });

  it('isValidHeaderRow accepts headers with expanded merchant terms', () => {
    expect(isValidHeaderRow(['작성일', '판매처', '금액'])).toBe(true);
    expect(isValidHeaderRow(['거래일', '취급처', '거래금액'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Vendor', 'Amount'])).toBe(true);
    expect(isValidHeaderRow(['date', 'item', 'total'])).toBe(true);
  });

  it('findColumn matches expanded merchant patterns', () => {
    const headers = ['작성일', '판매처', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Expanded amount keywords (C31)
// ---------------------------------------------------------------------------
describe('AMOUNT_COLUMN_PATTERN expanded keywords (C31)', () => {
  const shouldMatch = ['취소금액', '환불금액', '입금액', '결제액'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(AMOUNT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 취소금액 as amount column', () => {
    const headers = ['이용일', '이용처', '취소금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 환불금액 as amount column', () => {
    const headers = ['거래일', '가맹점', '환불금액', '비고'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 결제액 as amount column', () => {
    const headers = ['이용일', '이용처', '결제액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('AMOUNT_KEYWORDS contains new keywords', () => {
    expect(AMOUNT_KEYWORDS.has('취소금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('환불금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('입금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('결제액')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new amount keywords', () => {
    expect(HEADER_KEYWORDS).toContain('취소금액');
    expect(HEADER_KEYWORDS).toContain('환불금액');
    expect(HEADER_KEYWORDS).toContain('입금액');
    expect(HEADER_KEYWORDS).toContain('결제액');
  });

  it('isValidHeaderRow accepts headers with new amount keywords', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '취소금액'])).toBe(true);
    expect(isValidHeaderRow(['거래일', '가맹점', '환불금액'])).toBe(true);
    expect(isValidHeaderRow(['이용일', '이용처', '결제액'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Expanded category keywords (C31)
// ---------------------------------------------------------------------------
describe('CATEGORY_COLUMN_PATTERN expanded keywords (C31)', () => {
  const shouldMatch = ['거래유형', '결제유형', '이용구분', '구분', '가맹점유형'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(CATEGORY_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 거래유형 as category column', () => {
    const headers = ['이용일', '이용처', '이용금액', '거래유형'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn detects 결제유형 as category column', () => {
    const headers = ['이용일', '이용처', '결제유형', '이용금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 이용구분 as category column', () => {
    const headers = ['거래일', '가맹점', '금액', '이용구분'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn detects 구분 as category column', () => {
    const headers = ['이용일', '구분', '이용처', '금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(1);
  });

  it('findColumn detects 가맹점유형 as category column', () => {
    const headers = ['거래일', '가맹점유형', '가맹점', '금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Combined/delimited column headers (C33-04)
// ---------------------------------------------------------------------------
describe('Combined column headers (C33-04)', () => {
  it('findColumn matches "이용일/승인일" as date column', () => {
    const headers = ['이용일/승인일', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn matches "이용금액/취소금액" as amount column', () => {
    const headers = ['이용일', '가맹점명', '이용금액/취소금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn matches "비고/메모" as memo column', () => {
    const headers = ['이용일', '가맹점명', '이용금액', '비고/메모'];
    expect(findColumn(headers, undefined, MEMO_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn matches "할부/분할" as installments column', () => {
    const headers = ['이용일', '이용처', '금액', '할부/분할'];
    expect(findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn still matches non-delimited headers normally', () => {
    const headers = ['이용일', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('isValidHeaderRow accepts combined header "이용일/승인일"', () => {
    expect(isValidHeaderRow(['이용일/승인일', '가맹점명', '이용금액'])).toBe(true);
  });

  it('isValidHeaderRow accepts combined header with 2 categories via split', () => {
    // "이용일/승인일" splits to date keywords, "이용금액" is amount = 2 categories
    expect(isValidHeaderRow(['이용일/승인일', '이용금액'])).toBe(true);
  });

  it('isValidHeaderRow rejects combined header with only 1 category', () => {
    // "이용일/거래일" both date = 1 category, "날짜" also date = still 1
    expect(isValidHeaderRow(['이용일/거래일', '날짜'])).toBe(false);
  });

  it('findColumn with exactName matches combined headers via split (C43-01)', () => {
    const headers = ['이용일/승인일', '가맹점명', '이용금액'];
    // Exact name "이용일" should match via combined-header splitting
    // in the exact-match path (C43-01 fix)
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn with exactName matches second part of combined header (C43-01)', () => {
    const headers = ['이용일/승인일', '가맹점명', '이용금액/취소금액'];
    // "승인일" is the second part — should still match
    expect(findColumn(headers, '승인일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn with exactName matches amount in combined header (C43-01)', () => {
    const headers = ['이용일', '가맹점명', '이용금액/취소금액'];
    expect(findColumn(headers, '취소금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn with exactName matches memo in combined header (C43-01)', () => {
    const headers = ['이용일', '가맹점명', '이용금액', '비고/메모'];
    expect(findColumn(headers, '메모', MEMO_COLUMN_PATTERN)).toBe(3);
    expect(findColumn(headers, '비고', MEMO_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn with exactName prefers exact full-header match over split (C43-01)', () => {
    const headers = ['이용일', '이용일/승인일', '이용금액'];
    // "이용일" exact match should find index 0 (full match), not index 1 (split)
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cycle 36: New column pattern terms for broader format diversity
// ---------------------------------------------------------------------------

describe('Cycle 36: New DATE_COLUMN_PATTERN terms', () => {
  const shouldMatch = ['승인일시', '접수일', '발행일', 'posted', 'billing'];
  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(DATE_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 승인일시 as date column', () => {
    const headers = ['승인일시', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects 접수일 as date column', () => {
    const headers = ['접수일', '이용처', '금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects 발행일 as date column', () => {
    const headers = ['발행일', '상호', '결제금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects English "posted" as date column', () => {
    const headers = ['posted', 'name', 'amount'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects English "billing" as date column', () => {
    const headers = ['billing', 'merchant', 'total'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('DATE_KEYWORDS contains new terms', () => {
    expect(DATE_KEYWORDS.has('승인일시')).toBe(true);
    expect(DATE_KEYWORDS.has('접수일')).toBe(true);
    expect(DATE_KEYWORDS.has('발행일')).toBe(true);
    expect(DATE_KEYWORDS.has('posted')).toBe(true);
    expect(DATE_KEYWORDS.has('billing')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new date terms', () => {
    expect(HEADER_KEYWORDS).toContain('승인일시');
    expect(HEADER_KEYWORDS).toContain('접수일');
    expect(HEADER_KEYWORDS).toContain('발행일');
    expect(HEADER_KEYWORDS).toContain('posted');
    expect(HEADER_KEYWORDS).toContain('billing');
  });
});

describe('Cycle 36: New MERCHANT_COLUMN_PATTERN terms', () => {
  const shouldMatch = ['승인가맹점', '이용내용', '거래내용', 'name'];
  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(MERCHANT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 승인가맹점 as merchant column', () => {
    const headers = ['이용일', '승인가맹점', '이용금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('findColumn detects 이용내용 as merchant column', () => {
    const headers = ['거래일', '이용내용', '금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('findColumn detects 거래내용 as merchant column', () => {
    const headers = ['이용일', '거래내용', '결제금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('findColumn detects English "name" as merchant column', () => {
    const headers = ['date', 'name', 'amount'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('MERCHANT_KEYWORDS contains new terms', () => {
    expect(MERCHANT_KEYWORDS.has('승인가맹점')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('이용내용')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('거래내용')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('name')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new merchant terms', () => {
    expect(HEADER_KEYWORDS).toContain('승인가맹점');
    expect(HEADER_KEYWORDS).toContain('이용내용');
    expect(HEADER_KEYWORDS).toContain('거래내용');
    expect(HEADER_KEYWORDS).toContain('name');
  });

  it('isValidHeaderRow accepts header with new merchant terms', () => {
    expect(isValidHeaderRow(['이용일', '승인가맹점', '이용금액'])).toBe(true);
    expect(isValidHeaderRow(['거래일', '이용내용', '금액'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Name', 'Amount'])).toBe(true);
  });
});

describe('Cycle 36: New AMOUNT_COLUMN_PATTERN terms', () => {
  const shouldMatch = ['청구금액', '출금액', '결제대금', '승인취소금액', 'charge', 'payment'];
  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(AMOUNT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 청구금액 as amount column', () => {
    const headers = ['이용일', '이용처', '청구금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 출금액 as amount column', () => {
    const headers = ['거래일', '가맹점', '출금액', '비고'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 결제대금 as amount column', () => {
    const headers = ['이용일', '이용처', '결제대금'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 승인취소금액 as amount column', () => {
    const headers = ['이용일', '이용처', '승인취소금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects English "charge" as amount column', () => {
    const headers = ['date', 'name', 'charge'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects English "payment" as amount column', () => {
    const headers = ['date', 'merchant', 'payment'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('AMOUNT_KEYWORDS contains new terms', () => {
    expect(AMOUNT_KEYWORDS.has('청구금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('출금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('결제대금')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('승인취소금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('charge')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('payment')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new amount terms', () => {
    expect(HEADER_KEYWORDS).toContain('청구금액');
    expect(HEADER_KEYWORDS).toContain('출금액');
    expect(HEADER_KEYWORDS).toContain('결제대금');
    expect(HEADER_KEYWORDS).toContain('승인취소금액');
    expect(HEADER_KEYWORDS).toContain('charge');
    expect(HEADER_KEYWORDS).toContain('payment');
  });

  it('isValidHeaderRow accepts header with new amount terms', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '청구금액'])).toBe(true);
    expect(isValidHeaderRow(['거래일', '가맹점', '출금액'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Name', 'Charge'])).toBe(true);
    expect(isValidHeaderRow(['date', 'merchant', 'payment'])).toBe(true);
  });
});

describe('Cycle 36: New INSTALLMENTS_COLUMN_PATTERN terms', () => {
  it('matches 할부횟수', () => {
    expect(INSTALLMENTS_COLUMN_PATTERN.test('할부횟수')).toBe(true);
  });

  it('findColumn detects 할부횟수 as installments column', () => {
    const headers = ['이용일', '이용처', '금액', '할부횟수'];
    expect(findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN)).toBe(3);
  });
});

describe('Cycle 36: Header row with new terms (integration)', () => {
  it('accepts header row with 승인일시 + 승인가맹점 + 청구금액', () => {
    expect(isValidHeaderRow(['승인일시', '승인가맹점', '청구금액'])).toBe(true);
  });

  it('accepts header row with 접수일 + 거래내용 + 출금액', () => {
    expect(isValidHeaderRow(['접수일', '거래내용', '출금액'])).toBe(true);
  });

  it('accepts English header row with posted + name + charge', () => {
    expect(isValidHeaderRow(['posted', 'name', 'charge'])).toBe(true);
  });

  it('accepts English header row with billing + merchant + payment', () => {
    expect(isValidHeaderRow(['billing', 'merchant', 'payment'])).toBe(true);
  });

  it('accepts header with 발행일 + 이용내용 + 결제대금 + 할부횟수', () => {
    expect(isValidHeaderRow(['발행일', '이용내용', '결제대금', '할부횟수'])).toBe(true);
  });
});
// ---------------------------------------------------------------------------
// Variation selector and invisible character handling (C40-01)
// ---------------------------------------------------------------------------

describe('normalizeHeader variation selectors (C40-01)', () => {
  it('strips variation selectors U+FE00-FE0F from headers', () => {
    // U+FE00 is a variation selector that some Unicode-aware editors insert
    const header = '이︀용︁일︂';
    expect(normalizeHeader(header)).toBe('이용일');
  });

  it('strips word joiner U+2060 from headers', () => {
    const header = '이⁠용⁠금⁠액';
    expect(normalizeHeader(header)).toBe('이용금액');
  });

  it('still strips zero-width spaces alongside variation selectors', () => {
    const header = '이​용︀일';
    expect(normalizeHeader(header)).toBe('이용일');
  });

  it('findColumn matches headers with variation selectors', () => {
    const headers = ['이︀용︁일', '이⁠용⁠처', '이​용​금​액'];
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, '이용처', MERCHANT_COLUMN_PATTERN)).toBe(1);
    expect(findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cycle 46: New column pattern terms for broader format diversity
// ---------------------------------------------------------------------------
describe('Cycle 46: New DATE_COLUMN_PATTERN terms', () => {
  const shouldMatch = ['사용일', '사용일자'];
  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(DATE_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 사용일 as date column', () => {
    const headers = ['사용일', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects 사용일자 as date column', () => {
    const headers = ['사용일자', '사용처', '금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('DATE_KEYWORDS contains new terms', () => {
    expect(DATE_KEYWORDS.has('사용일')).toBe(true);
    expect(DATE_KEYWORDS.has('사용일자')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new date terms', () => {
    expect(HEADER_KEYWORDS).toContain('사용일');
    expect(HEADER_KEYWORDS).toContain('사용일자');
  });
});

describe('Cycle 46: New MERCHANT_COLUMN_PATTERN terms', () => {
  const shouldMatch = ['payee'];
  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(MERCHANT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects English "payee" as merchant column', () => {
    const headers = ['date', 'payee', 'amount'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('MERCHANT_KEYWORDS contains new terms', () => {
    expect(MERCHANT_KEYWORDS.has('payee')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new merchant terms', () => {
    expect(HEADER_KEYWORDS).toContain('payee');
  });
});

describe('Cycle 46: New AMOUNT_COLUMN_PATTERN terms', () => {
  it('matches 매입금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('매입금액')).toBe(true);
  });

  it('findColumn detects 매입금액 as amount column', () => {
    const headers = ['이용일', '이용처', '매입금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('AMOUNT_KEYWORDS contains 매입금액', () => {
    expect(AMOUNT_KEYWORDS.has('매입금액')).toBe(true);
  });

  it('HEADER_KEYWORDS contains 매입금액', () => {
    expect(HEADER_KEYWORDS).toContain('매입금액');
  });
});

describe('Cycle 46: New INSTALLMENTS_COLUMN_PATTERN terms', () => {
  const shouldMatch = ['할부회수', 'install'];
  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(INSTALLMENTS_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 할부회수 as installments column', () => {
    const headers = ['이용일', '이용처', '금액', '할부회수'];
    expect(findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn detects English "install" as installments column', () => {
    const headers = ['date', 'merchant', 'amount', 'install'];
    expect(findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN)).toBe(3);
  });
});

describe('Cycle 46: New MEMO_COLUMN_PATTERN terms', () => {
  it('matches 상세내역', () => {
    expect(MEMO_COLUMN_PATTERN.test('상세내역')).toBe(true);
  });

  it('findColumn detects 상세내역 as memo column', () => {
    const headers = ['이용일', '이용처', '금액', '상세내역'];
    expect(findColumn(headers, undefined, MEMO_COLUMN_PATTERN)).toBe(3);
  });
});

describe('Cycle 46: SUMMARY_ROW_PATTERN new terms', () => {
  it('matches 이월잔액', () => {
    expect(SUMMARY_ROW_PATTERN.test('이월잔액')).toBe(true);
  });

  it('matches 전월이월', () => {
    expect(SUMMARY_ROW_PATTERN.test('전월이월')).toBe(true);
  });

  it('matches 이월금액', () => {
    expect(SUMMARY_ROW_PATTERN.test('이월금액')).toBe(true);
  });

  it('matches 이월잔액 in longer string', () => {
    expect(SUMMARY_ROW_PATTERN.test('이월잔액 50,000')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('전월이월 100,000원')).toBe(true);
  });

  it('does not false-positive on merchant names containing 이월', () => {
    expect(SUMMARY_ROW_PATTERN.test('이월마트')).toBe(false);
  });
});

describe('Cycle 46: isValidHeaderRow with new terms', () => {
  it('accepts header row with 사용일 + 사용처 + 이용금액', () => {
    expect(isValidHeaderRow(['사용일', '사용처', '이용금액'])).toBe(true);
  });

  it('accepts header row with 사용일자 + 가맹점 + 매입금액', () => {
    expect(isValidHeaderRow(['사용일자', '가맹점', '매입금액'])).toBe(true);
  });

  it('accepts English header row with date + payee + amount', () => {
    expect(isValidHeaderRow(['date', 'payee', 'amount'])).toBe(true);
  });

  it('accepts header with 사용일 + 이용내용 + 매입금액 + 할부회수', () => {
    expect(isValidHeaderRow(['사용일', '이용내용', '매입금액', '할부회수'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cycle 49: "|" combined headers and new format patterns
// ---------------------------------------------------------------------------
describe('Cycle 49: findColumn with pipe-delimited combined headers', () => {
  it('splits "이용일|승인일" and matches date pattern', () => {
    const headers = ['이용일|승인일', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('splits "가맹점|이용처" and matches merchant pattern', () => {
    const headers = ['이용일', '가맹점|이용처', '이용금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('exact match works with pipe-delimited header', () => {
    const headers = ['이용일|승인일', '가맹점명', '이용금액'];
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('exact match works with pipe-delimited header (second part)', () => {
    const headers = ['승인일|이용일', '가맹점명', '이용금액'];
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('isValidHeaderRow splits pipe-delimited headers for keyword matching', () => {
    expect(isValidHeaderRow(['이용일|승인일', '가맹점명', '이용금액'])).toBe(true);
  });
});

describe('Cycle 49: SUMMARY_ROW_PATTERN pipe-delimited edge cases', () => {
  it('matches 합산 summary row', () => {
    expect(SUMMARY_ROW_PATTERN.test('합산')).toBe(true);
  });

  it('does not false-positive on 합산 inside merchant name', () => {
    expect(SUMMARY_ROW_PATTERN.test('합산마트')).toBe(false);
  });
});

describe('Cycle 50: SUMMARY_ROW_PATTERN "합계금액" variant (C50-03)', () => {
  it('matches "합계금액" as summary row', () => {
    expect(SUMMARY_ROW_PATTERN.test('합계금액')).toBe(true);
  });

  it('matches "합 계 금액" with spaces', () => {
    expect(SUMMARY_ROW_PATTERN.test('합 계 금액')).toBe(true);
  });

  it('does not false-positive on "합계마트" merchant name', () => {
    expect(SUMMARY_ROW_PATTERN.test('합계마트')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cycle 52: Comma/plus delimiter splitting, new keywords, summary patterns
// ---------------------------------------------------------------------------

describe('Cycle 52-01: findColumn comma/plus delimiter splitting', () => {
  it('splits comma-delimited combined header for exact match', () => {
    const headers = ['이용일,승인일', '가맹점명', '이용금액'];
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('splits comma-delimited combined header for exact match (second part)', () => {
    const headers = ['승인일,이용일', '가맹점명', '이용금액'];
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('splits comma-delimited combined header for regex match', () => {
    const headers = ['이용일,승인일', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('splits plus-delimited combined header for regex match', () => {
    const headers = ['이용일+승인일', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('splits fullwidth plus-delimited combined header', () => {
    const headers = ['이용일＋승인일', '가맹점명', '이용금액'];
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('isValidHeaderRow splits comma-delimited headers', () => {
    expect(isValidHeaderRow(['이용일,승인일', '가맹점명', '이용금액'])).toBe(true);
  });

  it('isValidHeaderRow splits plus-delimited headers', () => {
    expect(isValidHeaderRow(['이용일+승인일', '가맹점명', '이용금액'])).toBe(true);
  });
});

describe('Cycle 52-03: New merchant column keywords', () => {
  it('matches "이용업소" as merchant column', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('이용업소')).toBe(true);
  });

  it('matches "승인점" as merchant column', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('승인점')).toBe(true);
  });

  it('matches "매장명" as merchant column', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('매장명')).toBe(true);
  });

  it('matches "이용매장" as merchant column', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('이용매장')).toBe(true);
  });

  it('findColumn finds "이용업소" column', () => {
    const headers = ['이용일', '이용업소', '이용금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('findColumn finds "매장명" column', () => {
    const headers = ['이용일', '매장명', '이용금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('MERCHANT_KEYWORDS includes new terms', () => {
    expect(MERCHANT_KEYWORDS.has('이용업소')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('승인점')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('매장명')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('이용매장')).toBe(true);
  });
});

describe('Cycle 52-04: New memo column keywords', () => {
  it('matches "비고란" as memo column', () => {
    expect(MEMO_COLUMN_PATTERN.test('비고란')).toBe(true);
  });

  it('matches "메모란" as memo column', () => {
    expect(MEMO_COLUMN_PATTERN.test('메모란')).toBe(true);
  });

  it('matches "상세" as memo column', () => {
    expect(MEMO_COLUMN_PATTERN.test('상세')).toBe(true);
  });

  it('matches "비고내용" as memo column', () => {
    expect(MEMO_COLUMN_PATTERN.test('비고내용')).toBe(true);
  });

  it('matches "메모내용" as memo column', () => {
    expect(MEMO_COLUMN_PATTERN.test('메모내용')).toBe(true);
  });

  it('findColumn finds "비고란" column', () => {
    const headers = ['이용일', '이용금액', '비고란'];
    expect(findColumn(headers, undefined, MEMO_COLUMN_PATTERN)).toBe(2);
  });
});

describe('Cycle 52-05: New summary row patterns', () => {
  it('matches "사용합계" as summary row', () => {
    expect(SUMMARY_ROW_PATTERN.test('사용합계')).toBe(true);
  });

  it('matches "이용합계" as summary row', () => {
    expect(SUMMARY_ROW_PATTERN.test('이용합계')).toBe(true);
  });

  it('matches "총결제금액" as summary row', () => {
    expect(SUMMARY_ROW_PATTERN.test('총결제금액')).toBe(true);
  });

  it('matches "총이용금액" as summary row', () => {
    expect(SUMMARY_ROW_PATTERN.test('총이용금액')).toBe(true);
  });

  it('matches "총액" as summary row', () => {
    expect(SUMMARY_ROW_PATTERN.test('총액')).toBe(true);
  });

  it('does not false-positive on "총액" inside merchant name', () => {
    expect(SUMMARY_ROW_PATTERN.test('총액마트')).toBe(false);
  });

  it('matches "총 결제 금액" with spaces', () => {
    expect(SUMMARY_ROW_PATTERN.test('총 결제 금액')).toBe(true);
  });
});

describe('Cycle 52-07: New category column keywords', () => {
  it('matches "카드종류" as category column', () => {
    expect(CATEGORY_COLUMN_PATTERN.test('카드종류')).toBe(true);
  });

  it('matches "카드구분" as category column', () => {
    expect(CATEGORY_COLUMN_PATTERN.test('카드구분')).toBe(true);
  });

  it('findColumn finds "카드종류" column', () => {
    const headers = ['이용일', '카드종류', '이용금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(1);
  });
});

describe('Cycle 52: HEADER_KEYWORDS includes new terms', () => {
  it('includes new merchant keywords', () => {
    expect((HEADER_KEYWORDS as string[]).includes('이용업소')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('승인점')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('매장명')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('이용매장')).toBe(true);
  });

  it('includes new memo keywords', () => {
    expect((HEADER_KEYWORDS as string[]).includes('비고란')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('메모란')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('비고내용')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('메모내용')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('상세')).toBe(true);
  });
});

describe('Cycle 55: SUMMARY_ROW_PATTERN boundary guard consistency', () => {
  // Verify that multi-word compound patterns now have consistent boundary guards
  // preventing false positives on merchant names containing summary keywords.

  it('does NOT match "승인합계마트" (boundary guard on 승인 합계)', () => {
    expect(SUMMARY_ROW_PATTERN.test('승인합계마트')).toBe(false);
  });

  it('does NOT match "결제합계부" (boundary guard on 결제 합계)', () => {
    expect(SUMMARY_ROW_PATTERN.test('결제합계부')).toBe(false);
  });

  it('does NOT match "사용합계마트" (boundary guard on 사용 합계)', () => {
    expect(SUMMARY_ROW_PATTERN.test('사용합계마트')).toBe(false);
  });

  it('does NOT match "이용합계부" (boundary guard on 이용 합계)', () => {
    expect(SUMMARY_ROW_PATTERN.test('이용합계부')).toBe(false);
  });

  it('does NOT match "총사용마트" (boundary guard on 총 사용)', () => {
    expect(SUMMARY_ROW_PATTERN.test('총사용마트')).toBe(false);
  });

  it('does NOT match "총이용마트" (boundary guard on 총 이용)', () => {
    expect(SUMMARY_ROW_PATTERN.test('총이용마트')).toBe(false);
  });

  it('does NOT match "총결제금액마트" (boundary guard on 총 결제 금액)', () => {
    expect(SUMMARY_ROW_PATTERN.test('총결제금액마트')).toBe(false);
  });

  it('does NOT match "총이용금액마트" (boundary guard on 총 이용 금액)', () => {
    expect(SUMMARY_ROW_PATTERN.test('총이용금액마트')).toBe(false);
  });

  it('does NOT match "합계금액마트" (boundary guard on 합 계 금액)', () => {
    expect(SUMMARY_ROW_PATTERN.test('합계금액마트')).toBe(false);
  });

  // Positive cases still work — these compound summary phrases match correctly
  it('still matches "승인 합계" with space', () => {
    expect(SUMMARY_ROW_PATTERN.test('승인 합계')).toBe(true);
  });

  it('still matches "결제 합계" with space', () => {
    expect(SUMMARY_ROW_PATTERN.test('결제 합계')).toBe(true);
  });

  it('still matches "사용 합계" with space', () => {
    expect(SUMMARY_ROW_PATTERN.test('사용 합계')).toBe(true);
  });

  it('still matches "이용 합계" with space', () => {
    expect(SUMMARY_ROW_PATTERN.test('이용 합계')).toBe(true);
  });

  it('still matches "총 사용" with space', () => {
    expect(SUMMARY_ROW_PATTERN.test('총 사용')).toBe(true);
  });

  it('still matches "총 이용" with space', () => {
    expect(SUMMARY_ROW_PATTERN.test('총 이용')).toBe(true);
  });

  it('still matches "합계금액" as standalone', () => {
    expect(SUMMARY_ROW_PATTERN.test('합계금액')).toBe(true);
  });

  it('still matches "총결제금액" as standalone', () => {
    expect(SUMMARY_ROW_PATTERN.test('총결제금액')).toBe(true);
  });

  it('still matches "총이용금액" as standalone', () => {
    expect(SUMMARY_ROW_PATTERN.test('총이용금액')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cycle 60: New column pattern terms for broader format diversity
// ---------------------------------------------------------------------------
describe('Cycle 60: New DATE_COLUMN_PATTERN terms', () => {
  const shouldMatch = ['조회일', '처리일', '승인완료일'];
  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(DATE_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 조회일 as date column', () => {
    const headers = ['조회일', '가맹점명', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects 처리일 as date column', () => {
    const headers = ['처리일', '이용처', '금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects 승인완료일 as date column', () => {
    const headers = ['승인완료일', '상호', '결제금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('DATE_KEYWORDS contains new terms', () => {
    expect(DATE_KEYWORDS.has('조회일')).toBe(true);
    expect(DATE_KEYWORDS.has('처리일')).toBe(true);
    expect(DATE_KEYWORDS.has('승인완료일')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new date terms', () => {
    expect(HEADER_KEYWORDS).toContain('조회일');
    expect(HEADER_KEYWORDS).toContain('처리일');
    expect(HEADER_KEYWORDS).toContain('승인완료일');
  });
});

describe('Cycle 60: New INSTALLMENTS_COLUMN_PATTERN terms', () => {
  it('matches 할부회차', () => {
    expect(INSTALLMENTS_COLUMN_PATTERN.test('할부회차')).toBe(true);
  });

  it('findColumn detects 할부회차 as installments column', () => {
    const headers = ['이용일', '이용처', '금액', '할부회차'];
    expect(findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN)).toBe(3);
  });
});

describe('Cycle 60: New MEMO_COLUMN_PATTERN terms', () => {
  it('matches 참고사항', () => {
    expect(MEMO_COLUMN_PATTERN.test('참고사항')).toBe(true);
  });

  it('findColumn detects 참고사항 as memo column', () => {
    const headers = ['이용일', '이용처', '금액', '참고사항'];
    expect(findColumn(headers, undefined, MEMO_COLUMN_PATTERN)).toBe(3);
  });

  it('HEADER_KEYWORDS contains 참고사항', () => {
    expect(HEADER_KEYWORDS).toContain('참고사항');
  });
});

describe('Cycle 60: isValidHeaderRow with new terms', () => {
  it('accepts header row with 조회일 + 가맹점 + 이용금액', () => {
    expect(isValidHeaderRow(['조회일', '가맹점', '이용금액'])).toBe(true);
  });

  it('accepts header row with 처리일 + 이용처 + 거래금액', () => {
    expect(isValidHeaderRow(['처리일', '이용처', '거래금액'])).toBe(true);
  });

  it('accepts header row with 승인완료일 + 가맹점명 + 청구금액 + 할부회차', () => {
    expect(isValidHeaderRow(['승인완료일', '가맹점명', '청구금액', '할부회차'])).toBe(true);
  });

  it('accepts header row with 조회일 + 이용처 + 금액 + 참고사항', () => {
    expect(isValidHeaderRow(['조회일', '이용처', '금액', '참고사항'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cycle 69: Expanded column patterns for broader bank format coverage
// ---------------------------------------------------------------------------
describe('Cycle 69: expanded column patterns', () => {
  // New date terms
  it('DATE_COLUMN_PATTERN matches 입금일', () => {
    expect(DATE_COLUMN_PATTERN.test('입금일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 주문일', () => {
    expect(DATE_COLUMN_PATTERN.test('주문일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 결제예정일', () => {
    expect(DATE_COLUMN_PATTERN.test('결제예정일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 작성일시', () => {
    expect(DATE_COLUMN_PATTERN.test('작성일시')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 승인시간', () => {
    expect(DATE_COLUMN_PATTERN.test('승인시간')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches purchase_date', () => {
    expect(DATE_COLUMN_PATTERN.test('purchase_date')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches order_date', () => {
    expect(DATE_COLUMN_PATTERN.test('order_date')).toBe(true);
  });

  // New merchant terms
  it('MERCHANT_COLUMN_PATTERN matches 상호명', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('상호명')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches 업체명', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('업체명')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches 판매자', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('판매자')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches 가맹점상호', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('가맹점상호')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches seller', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('seller')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches company', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('company')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches business', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('business')).toBe(true);
  });

  // New amount terms
  it('AMOUNT_COLUMN_PATTERN matches 실청구금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('실청구금액')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 실결제금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('실결제금액')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 결제예정금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('결제예정금액')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches total_amount', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('total_amount')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches paid', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('paid')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches spent', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('spent')).toBe(true);
  });

  // New memo terms
  it('MEMO_COLUMN_PATTERN matches 승인번호', () => {
    expect(MEMO_COLUMN_PATTERN.test('승인번호')).toBe(true);
  });
  it('MEMO_COLUMN_PATTERN matches 카드번호', () => {
    expect(MEMO_COLUMN_PATTERN.test('카드번호')).toBe(true);
  });
  it('MEMO_COLUMN_PATTERN matches 승인내역', () => {
    expect(MEMO_COLUMN_PATTERN.test('승인내역')).toBe(true);
  });
  it('MEMO_COLUMN_PATTERN matches 비고사항', () => {
    expect(MEMO_COLUMN_PATTERN.test('비고사항')).toBe(true);
  });
  it('MEMO_COLUMN_PATTERN matches approval_no', () => {
    expect(MEMO_COLUMN_PATTERN.test('approval_no')).toBe(true);
  });

  // New summary row patterns
  it('SUMMARY_ROW_PATTERN matches 당월청구금액', () => {
    expect(SUMMARY_ROW_PATTERN.test('당월청구금액')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 이전잔액', () => {
    expect(SUMMARY_ROW_PATTERN.test('이전잔액')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 결제완료', () => {
    expect(SUMMARY_ROW_PATTERN.test('결제완료')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 할인합계', () => {
    expect(SUMMARY_ROW_PATTERN.test('할인합계')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 포인트사용', () => {
    expect(SUMMARY_ROW_PATTERN.test('포인트사용')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 포인트적립', () => {
    expect(SUMMARY_ROW_PATTERN.test('포인트적립')).toBe(true);
  });

  // isValidHeaderRow with new terms
  it('accepts header row with 입금일 + 상호명 + 실청구금액', () => {
    expect(isValidHeaderRow(['입금일', '상호명', '실청구금액'])).toBe(true);
  });
  it('accepts header row with 주문일 + 판매자 + 결제예정금액', () => {
    expect(isValidHeaderRow(['주문일', '판매자', '결제예정금액'])).toBe(true);
  });
  it('accepts header row with purchase_date + seller + total_amount', () => {
    expect(isValidHeaderRow(['purchase_date', 'seller', 'total_amount'])).toBe(true);
  });
  it('accepts header row with 결제예정일 + 가맹점상호 + 금액 + 승인번호', () => {
    expect(isValidHeaderRow(['결제예정일', '가맹점상호', '금액', '승인번호'])).toBe(true);
  });

  // findColumn with new terms
  it('findColumn detects 입금일 as date column', () => {
    const headers = ['입금일', '업체명', '실청구금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });
  it('findColumn detects 상호명 as merchant column', () => {
    const headers = ['거래일', '상호명', '거래금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });
  it('findColumn detects 실청구금액 as amount column', () => {
    const headers = ['이용일', '이용처', '실청구금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });
  it('findColumn detects 승인번호 as memo column', () => {
    const headers = ['이용일', '가맹점', '금액', '승인번호'];
    expect(findColumn(headers, undefined, MEMO_COLUMN_PATTERN)).toBe(3);
  });

  // HEADER_KEYWORDS contains new terms
  it('HEADER_KEYWORDS contains new date terms', () => {
    expect(HEADER_KEYWORDS).toContain('입금일');
    expect(HEADER_KEYWORDS).toContain('주문일');
    expect(HEADER_KEYWORDS).toContain('결제예정일');
  });
  it('HEADER_KEYWORDS contains new merchant terms', () => {
    expect(HEADER_KEYWORDS).toContain('상호명');
    expect(HEADER_KEYWORDS).toContain('업체명');
    expect(HEADER_KEYWORDS).toContain('판매자');
  });
  it('HEADER_KEYWORDS contains new amount terms', () => {
    expect(HEADER_KEYWORDS).toContain('실청구금액');
    expect(HEADER_KEYWORDS).toContain('실결제금액');
    expect(HEADER_KEYWORDS).toContain('결제예정금액');
  });
  it('HEADER_KEYWORDS contains new memo terms', () => {
    expect(HEADER_KEYWORDS).toContain('승인번호');
    expect(HEADER_KEYWORDS).toContain('카드번호');
    expect(HEADER_KEYWORDS).toContain('승인내역');
  });
  it('HEADER_KEYWORDS contains C72 new terms', () => {
    expect(HEADER_KEYWORDS).toContain('매입일');
    expect(HEADER_KEYWORDS).toContain('전표일');
    expect(HEADER_KEYWORDS).toContain('거래내역');
    expect(HEADER_KEYWORDS).toContain('이용가맹점명');
    expect(HEADER_KEYWORDS).toContain('사용금액');
  });
});

// ---------------------------------------------------------------------------
// C72: New column pattern coverage
// ---------------------------------------------------------------------------

describe('C72: New column pattern coverage', () => {
  it('DATE_COLUMN_PATTERN matches 매입일', () => {
    expect(DATE_COLUMN_PATTERN.test('매입일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 전표일', () => {
    expect(DATE_COLUMN_PATTERN.test('전표일')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches 거래내역', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('거래내역')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches 이용가맹점명', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('이용가맹점명')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 사용금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('사용금액')).toBe(true);
  });
  it('DATE_KEYWORDS contains 매입일', () => {
    expect(DATE_KEYWORDS.has('매입일')).toBe(true);
  });
  it('DATE_KEYWORDS contains 전표일', () => {
    expect(DATE_KEYWORDS.has('전표일')).toBe(true);
  });
  it('MERCHANT_KEYWORDS contains 거래내역', () => {
    expect(MERCHANT_KEYWORDS.has('거래내역')).toBe(true);
  });
  it('MERCHANT_KEYWORDS contains 이용가맹점명', () => {
    expect(MERCHANT_KEYWORDS.has('이용가맹점명')).toBe(true);
  });
  it('AMOUNT_KEYWORDS contains 사용금액', () => {
    expect(AMOUNT_KEYWORDS.has('사용금액')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cycle 73: New column header patterns (C73-03)
// ---------------------------------------------------------------------------

describe('Cycle 73: New column header patterns (C73-03)', () => {
  it('DATE_COLUMN_PATTERN matches 이용시간', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('이용시간'))).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches book_date', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('book_date'))).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches recipient', () => {
    expect(MERCHANT_COLUMN_PATTERN.test(normalizeHeader('recipient'))).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches outlet', () => {
    expect(MERCHANT_COLUMN_PATTERN.test(normalizeHeader('outlet'))).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 환급금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test(normalizeHeader('환급금액'))).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 입금금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test(normalizeHeader('입금금액'))).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 실입금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test(normalizeHeader('실입금액'))).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches debit', () => {
    expect(AMOUNT_COLUMN_PATTERN.test(normalizeHeader('debit'))).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches credit', () => {
    expect(AMOUNT_COLUMN_PATTERN.test(normalizeHeader('credit'))).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches net', () => {
    expect(AMOUNT_COLUMN_PATTERN.test(normalizeHeader('net'))).toBe(true);
  });
  it('MEMO_COLUMN_PATTERN matches 카드명', () => {
    expect(MEMO_COLUMN_PATTERN.test(normalizeHeader('카드명'))).toBe(true);
  });
  it('MEMO_COLUMN_PATTERN matches 이용카드', () => {
    expect(MEMO_COLUMN_PATTERN.test(normalizeHeader('이용카드'))).toBe(true);
  });
  it('DATE_KEYWORDS contains 이용시간', () => {
    expect(DATE_KEYWORDS.has('이용시간')).toBe(true);
  });
  it('DATE_KEYWORDS contains bookdate', () => {
    expect(DATE_KEYWORDS.has('bookdate')).toBe(true);
  });
  it('AMOUNT_KEYWORDS contains 환급금액', () => {
    expect(AMOUNT_KEYWORDS.has('환급금액')).toBe(true);
  });
  it('AMOUNT_KEYWORDS contains debit', () => {
    expect(AMOUNT_KEYWORDS.has('debit')).toBe(true);
  });
  it('AMOUNT_KEYWORDS contains credit', () => {
    expect(AMOUNT_KEYWORDS.has('credit')).toBe(true);
  });
  it('MERCHANT_KEYWORDS contains recipient', () => {
    expect(MERCHANT_KEYWORDS.has('recipient')).toBe(true);
  });
  it('MERCHANT_KEYWORDS contains outlet', () => {
    expect(MERCHANT_KEYWORDS.has('outlet')).toBe(true);
  });
  it('HEADER_KEYWORDS contains 카드명', () => {
    expect((HEADER_KEYWORDS as string[]).includes('카드명')).toBe(true);
  });
  it('HEADER_KEYWORDS contains 이용카드', () => {
    expect((HEADER_KEYWORDS as string[]).includes('이용카드')).toBe(true);
  });
  it('findColumn detects 환급금액 column', () => {
    const headers = ['이용일', '가맹점', '환급금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });
  it('findColumn detects book_date column', () => {
    const headers = ['book_date', 'merchant', 'amount'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });
  it('findColumn detects debit column as amount', () => {
    const headers = ['date', 'merchant', 'debit'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  // C76-01: New date column patterns for cancel/settlement/refund dates
  it('DATE_COLUMN_PATTERN matches 취소일 (cancel date)', () => {
    expect(DATE_COLUMN_PATTERN.test('취소일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 정산일 (settlement date)', () => {
    expect(DATE_COLUMN_PATTERN.test('정산일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 환불일 (refund date)', () => {
    expect(DATE_COLUMN_PATTERN.test('환불일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 반품일 (return date)', () => {
    expect(DATE_COLUMN_PATTERN.test('반품일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 교환일 (exchange date)', () => {
    expect(DATE_COLUMN_PATTERN.test('교환일')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches cancel_date (English)', () => {
    expect(DATE_COLUMN_PATTERN.test('cancel_date')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches refund_date (English)', () => {
    expect(DATE_COLUMN_PATTERN.test('refund_date')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches settlement_date (English)', () => {
    expect(DATE_COLUMN_PATTERN.test('settlement_date')).toBe(true);
  });

  // C76-01: New date terms in HEADER_KEYWORDS
  it('HEADER_KEYWORDS contains 취소일', () => {
    expect((HEADER_KEYWORDS as string[]).includes('취소일')).toBe(true);
  });
  it('HEADER_KEYWORDS contains 정산일', () => {
    expect((HEADER_KEYWORDS as string[]).includes('정산일')).toBe(true);
  });
  it('HEADER_KEYWORDS contains 환불일', () => {
    expect((HEADER_KEYWORDS as string[]).includes('환불일')).toBe(true);
  });

  // C76-01: New date terms in DATE_KEYWORDS
  it('DATE_KEYWORDS contains 취소일', () => {
    expect(DATE_KEYWORDS.has('취소일')).toBe(true);
  });
  it('DATE_KEYWORDS contains 정산일', () => {
    expect(DATE_KEYWORDS.has('정산일')).toBe(true);
  });
  it('DATE_KEYWORDS contains 환불일', () => {
    expect(DATE_KEYWORDS.has('환불일')).toBe(true);
  });
  it('DATE_KEYWORDS contains cancel_date (English)', () => {
    expect(DATE_KEYWORDS.has('canceldate')).toBe(true);
  });
  it('DATE_KEYWORDS contains refund_date (English)', () => {
    expect(DATE_KEYWORDS.has('refunddate')).toBe(true);
  });
  it('DATE_KEYWORDS contains settlement_date (English)', () => {
    expect(DATE_KEYWORDS.has('settlementdate')).toBe(true);
  });

  // C76-01: findColumn detects new date columns
  it('findColumn detects 취소일 column', () => {
    const headers = ['이용일', '이용처', '이용금액', '취소일'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, '취소일', DATE_COLUMN_PATTERN)).toBe(3);
  });
  it('findColumn detects 정산일 column', () => {
    const headers = ['정산일', '가맹점', '금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  // C76-01: Summary row patterns for installment fees and late fees
  it('SUMMARY_ROW_PATTERN matches 할부수수료합계', () => {
    expect(SUMMARY_ROW_PATTERN.test('할부수수료합계 5,000')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 수수료합계', () => {
    expect(SUMMARY_ROW_PATTERN.test('수수료합계 3,000')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 연체료합계', () => {
    expect(SUMMARY_ROW_PATTERN.test('연체료합계 10,000')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 연체 이자', () => {
    expect(SUMMARY_ROW_PATTERN.test('연체 이자 2,000')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN does not match 수수료 inside merchant name', () => {
    expect(SUMMARY_ROW_PATTERN.test('수수료마트')).toBe(false);
  });

  // C78-01: New date terms
  it('DATE_COLUMN_PATTERN matches 결제일시', () => {
    expect(DATE_COLUMN_PATTERN.test('결제일시')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 주문시간', () => {
    expect(DATE_COLUMN_PATTERN.test('주문시간')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches 승인완료', () => {
    expect(DATE_COLUMN_PATTERN.test('승인완료')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches statementdate (English)', () => {
    expect(DATE_COLUMN_PATTERN.test('statementdate')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches payment_date (English)', () => {
    expect(DATE_COLUMN_PATTERN.test('paymentdate')).toBe(true);
  });
  it('DATE_COLUMN_PATTERN matches timestamp (English)', () => {
    expect(DATE_COLUMN_PATTERN.test('timestamp')).toBe(true);
  });
  it('DATE_KEYWORDS contains 결제일시', () => {
    expect(DATE_KEYWORDS.has('결제일시')).toBe(true);
  });
  it('DATE_KEYWORDS contains statementdate', () => {
    expect(DATE_KEYWORDS.has('statementdate')).toBe(true);
  });

  // C78-01: New merchant terms
  it('MERCHANT_COLUMN_PATTERN matches 상점', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('상점')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches 판매점', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('판매점')).toBe(true);
  });
  it('MERCHANT_COLUMN_PATTERN matches supplier (English)', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('supplier')).toBe(true);
  });
  it('MERCHANT_KEYWORDS contains 상점', () => {
    expect(MERCHANT_KEYWORDS.has('상점')).toBe(true);
  });

  // C78-01: New amount terms
  it('AMOUNT_COLUMN_PATTERN matches 이용대금', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('이용대금')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 실결제액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('실결제액')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches 청구액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('청구액')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches transactionamount (English)', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('transactionamount')).toBe(true);
  });
  it('AMOUNT_COLUMN_PATTERN matches gross (English)', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('gross')).toBe(true);
  });
  it('AMOUNT_KEYWORDS contains 이용대금', () => {
    expect(AMOUNT_KEYWORDS.has('이용대금')).toBe(true);
  });

  // C78-01: New category terms
  it('CATEGORY_COLUMN_PATTERN matches 결제구분', () => {
    expect(CATEGORY_COLUMN_PATTERN.test('결제구분')).toBe(true);
  });

  // C78-01: New memo terms
  it('MEMO_COLUMN_PATTERN matches 기타', () => {
    expect(MEMO_COLUMN_PATTERN.test('기타')).toBe(true);
  });

  // C78-02: New summary row patterns
  it('SUMMARY_ROW_PATTERN matches 포인트합계', () => {
    expect(SUMMARY_ROW_PATTERN.test('포인트합계 5,000')).toBe(true);
  });
  it('SUMMARY_ROW_PATTERN matches 승인취소합계', () => {
    expect(SUMMARY_ROW_PATTERN.test('승인취소합계 3,000')).toBe(true);
  });

  // C78-05: findColumn with + delimiter in combined headers
  it('findColumn splits combined headers on + delimiter', () => {
    const headers = ['이용일+승인일', '가맹점', '금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });
  it('findColumn splits combined headers on fullwidth + delimiter', () => {
    const headers = ['이용일＋승인일', '가맹점', '금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  // C78-05: findColumn with 3-part combined headers
  it('findColumn splits 3-part combined headers', () => {
    const headers = ['이용일/승인일/매출일', '가맹점', '금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  // C78-05: English-only header detection
  it('isValidHeaderRow accepts English-only headers', () => {
    expect(isValidHeaderRow(['date', 'merchant', 'amount'])).toBe(true);
  });
  it('isValidHeaderRow accepts English headers with underscores', () => {
    expect(isValidHeaderRow(['transaction_date', 'vendor_name', 'total_amount'])).toBe(true);
  });
  it('isValidHeaderRow rejects single-category English headers', () => {
    expect(isValidHeaderRow(['amount', 'total', 'price'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cycle 79: CATEGORY/MEMO keyword Sets, English date abbreviations, 가게/기타
// ---------------------------------------------------------------------------

describe('Cycle 79: CATEGORY_KEYWORDS and MEMO_KEYWORDS Sets', () => {
  it('CATEGORY_KEYWORDS contains Korean category terms', () => {
    expect(CATEGORY_KEYWORDS.has('업종')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('카테고리')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('분류')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('거래유형')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('결제유형')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('결제구분')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('이용구분')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('구분')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('가맹점유형')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('매장유형')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('카드종류')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('카드구분')).toBe(true);
  });

  it('CATEGORY_KEYWORDS contains English category terms', () => {
    expect(CATEGORY_KEYWORDS.has('category')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('type')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('paymenttype')).toBe(true);
  });

  it('MEMO_KEYWORDS contains Korean memo terms', () => {
    expect(MEMO_KEYWORDS.has('비고')).toBe(true);
    expect(MEMO_KEYWORDS.has('적요')).toBe(true);
    expect(MEMO_KEYWORDS.has('메모')).toBe(true);
    expect(MEMO_KEYWORDS.has('기타')).toBe(true);
    expect(MEMO_KEYWORDS.has('승인번호')).toBe(true);
    expect(MEMO_KEYWORDS.has('카드번호')).toBe(true);
  });

  it('MEMO_KEYWORDS contains English memo terms', () => {
    expect(MEMO_KEYWORDS.has('memo')).toBe(true);
    expect(MEMO_KEYWORDS.has('note')).toBe(true);
    expect(MEMO_KEYWORDS.has('remarks')).toBe(true);
    expect(MEMO_KEYWORDS.has('approvalno')).toBe(true);
  });
});

describe('Cycle 79: isValidHeaderRow with category+memo 2-category check', () => {
  it('accepts header with category + memo keywords (2 categories)', () => {
    // 거래유형 (CATEGORY) + 비고 (MEMO) = 2 categories
    expect(isValidHeaderRow(['거래유형', '비고'])).toBe(true);
  });

  it('accepts header with category + date keywords (2 categories)', () => {
    expect(isValidHeaderRow(['결제유형', '이용일'])).toBe(true);
  });

  it('accepts header with memo + amount keywords (2 categories)', () => {
    expect(isValidHeaderRow(['메모', '이용금액'])).toBe(true);
  });

  it('accepts header with 거래유형 + 결제구분 + 메모 (category + memo)', () => {
    expect(isValidHeaderRow(['거래유형', '결제구분', '메모'])).toBe(true);
  });

  it('accepts header with English category + memo terms', () => {
    expect(isValidHeaderRow(['category', 'memo'])).toBe(true);
    expect(isValidHeaderRow(['type', 'note'])).toBe(true);
  });

  it('rejects header with only single-category terms', () => {
    // Only category keywords (1 category)
    expect(isValidHeaderRow(['거래유형', '결제유형', '카드종류'])).toBe(false);
  });
});

describe('Cycle 79: English date abbreviations', () => {
  it('DATE_COLUMN_PATTERN matches txn_date', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('txn_date'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches txn_dt', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('txn_dt'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches txn date', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('txn date'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches trans_date', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('trans_date'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches trans_dt', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('trans_dt'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches transaction_date (existing)', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('transaction_date'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches transaction_dt', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('transaction_dt'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches purchase_date (existing)', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('purchase_date'))).toBe(true);
  });

  it('DATE_COLUMN_PATTERN matches purchase_dt', () => {
    expect(DATE_COLUMN_PATTERN.test(normalizeHeader('purchase_dt'))).toBe(true);
  });

  it('DATE_KEYWORDS contains English date abbreviations', () => {
    expect(DATE_KEYWORDS.has('txndate')).toBe(true);
    expect(DATE_KEYWORDS.has('txndt')).toBe(true);
    expect(DATE_KEYWORDS.has('transdate')).toBe(true);
    expect(DATE_KEYWORDS.has('transdt')).toBe(true);
    expect(DATE_KEYWORDS.has('transactiondt')).toBe(true);
    expect(DATE_KEYWORDS.has('purchasedt')).toBe(true);
  });

  it('HEADER_KEYWORDS contains English date abbreviations', () => {
    expect((HEADER_KEYWORDS as string[]).includes('txn')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('txndate')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('txndt')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('transdate')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('transdt')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('purchasedt')).toBe(true);
  });

  it('isValidHeaderRow accepts txn_dt + merchant + amount', () => {
    expect(isValidHeaderRow(['txn_dt', 'merchant', 'amount'])).toBe(true);
  });

  it('isValidHeaderRow accepts trans_date + shop + total', () => {
    expect(isValidHeaderRow(['trans_date', 'shop', 'total'])).toBe(true);
  });

  it('findColumn detects txn_date as date column', () => {
    const headers = ['txn_date', 'merchant', 'amount'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects trans_dt as date column', () => {
    const headers = ['trans_dt', 'vendor', 'total'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn detects purchase_dt as date column', () => {
    const headers = ['purchase_dt', 'shop', 'price'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });
});

describe('Cycle 79: 가게 merchant and 기타 memo in HEADER_KEYWORDS', () => {
  it('MERCHANT_COLUMN_PATTERN matches 가게', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('가게')).toBe(true);
  });

  it('MERCHANT_KEYWORDS contains 가게', () => {
    expect(MERCHANT_KEYWORDS.has('가게')).toBe(true);
  });

  it('HEADER_KEYWORDS contains 가게', () => {
    expect((HEADER_KEYWORDS as string[]).includes('가게')).toBe(true);
  });

  it('HEADER_KEYWORDS contains 기타', () => {
    expect((HEADER_KEYWORDS as string[]).includes('기타')).toBe(true);
  });

  it('HEADER_KEYWORDS contains category terms', () => {
    expect((HEADER_KEYWORDS as string[]).includes('업종')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('카테고리')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('거래유형')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('결제유형')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('결제구분')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('이용구분')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('구분')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('가맹점유형')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('매장유형')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('카드종류')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('카드구분')).toBe(true);
  });

  it('HEADER_KEYWORDS contains English category/memo terms', () => {
    expect((HEADER_KEYWORDS as string[]).includes('category')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('type')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('paymenttype')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('desc')).toBe(true);
    expect((HEADER_KEYWORDS as string[]).includes('amt')).toBe(true);
  });

  it('findColumn detects 가게 as merchant column', () => {
    const headers = ['이용일', '가게', '금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });

  it('findColumn detects 기타 as memo column', () => {
    const headers = ['이용일', '가맹점', '금액', '기타'];
    expect(findColumn(headers, undefined, MEMO_COLUMN_PATTERN)).toBe(3);
  });

  it('isValidHeaderRow accepts 가게 + 이용금액 header', () => {
    expect(isValidHeaderRow(['이용일', '가게', '이용금액'])).toBe(true);
  });

  it('isValidHeaderRow accepts 거래유형 + 이용일 header', () => {
    expect(isValidHeaderRow(['거래유형', '이용일'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cycle 80: Fullwidth alphanumeric normalization, new column patterns, summary patterns
// ---------------------------------------------------------------------------

describe('Cycle 80: normalizeHeader fullwidth alphanumeric (C80-01)', () => {
  it('converts fullwidth Latin uppercase to ASCII', () => {
    // Ｄ (U+FF24 uppercase D), ａ (U+FF41 lowercase a), ｔ (U+FF54 lowercase t), ｅ (U+FF45 lowercase e)
    expect(normalizeHeader('Ｄａｔｅ')).toBe('Date');
  });

  it('converts fullwidth Latin lowercase to ASCII', () => {
    expect(normalizeHeader('ａｍｏｕｎｔ')).toBe('amount');
  });

  it('converts fullwidth digits to ASCII', () => {
    expect(normalizeHeader('１２３')).toBe('123');
  });

  it('converts mixed fullwidth uppercase and lowercase', () => {
    // Ｔ (U+FF34 uppercase) ｏ (U+FF4F lowercase) ｔ (U+FF54 lowercase) ａ (U+FF41 lowercase) ｌ (U+FF4C lowercase)
    expect(normalizeHeader('Ｔｏｔａｌ')).toBe('Total');
  });

  it('converts fullwidth uppercase letters in Korean-mixed header', () => {
    // Fullwidth "A" (U+FF21) + Korean — converts to uppercase ASCII "A"
    expect(normalizeHeader('Ａ이용금액')).toBe('A이용금액');
  });

  it('findColumn matches fullwidth header "Ｄａｔｅ" as date column', () => {
    const headers = ['Ｄａｔｅ', 'Merchant', 'Amount'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('findColumn matches fullwidth header "Ａｍｏｕｎｔ" as amount column', () => {
    const headers = ['Date', 'Merchant', 'Ａｍｏｕｎｔ'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('isValidHeaderRow accepts fullwidth headers', () => {
    expect(isValidHeaderRow(['Ｄａｔｅ', 'Ｍｅｒｃｈａｎｔ', 'Ａｍｏｕｎｔ'])).toBe(true);
  });
});

describe('Cycle 80: New CATEGORY_COLUMN_PATTERN terms (C80-02)', () => {
  it('CATEGORY_COLUMN_PATTERN matches 결제수단', () => {
    expect(CATEGORY_COLUMN_PATTERN.test('결제수단')).toBe(true);
  });

  it('CATEGORY_COLUMN_PATTERN matches 결제방법', () => {
    expect(CATEGORY_COLUMN_PATTERN.test('결제방법')).toBe(true);
  });

  it('CATEGORY_COLUMN_PATTERN matches payment_method (English)', () => {
    expect(CATEGORY_COLUMN_PATTERN.test(normalizeHeader('payment_method'))).toBe(true);
  });

  it('CATEGORY_KEYWORDS contains new terms', () => {
    expect(CATEGORY_KEYWORDS.has('결제수단')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('결제방법')).toBe(true);
    expect(CATEGORY_KEYWORDS.has('paymentmethod')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new category terms', () => {
    expect(HEADER_KEYWORDS).toContain('결제수단');
    expect(HEADER_KEYWORDS).toContain('결제방법');
    expect(HEADER_KEYWORDS).toContain('paymentmethod');
  });

  it('findColumn detects 결제수단 as category column', () => {
    const headers = ['이용일', '결제수단', '이용금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(1);
  });

  it('isValidHeaderRow accepts 결제수단 + 이용일 header', () => {
    expect(isValidHeaderRow(['결제수단', '이용일'])).toBe(true);
  });
});

describe('Cycle 80: New MERCHANT_COLUMN_PATTERN terms (C80-02)', () => {
  it('MERCHANT_COLUMN_PATTERN matches 취소가맹점', () => {
    expect(MERCHANT_COLUMN_PATTERN.test('취소가맹점')).toBe(true);
  });

  it('MERCHANT_KEYWORDS contains 취소가맹점', () => {
    expect(MERCHANT_KEYWORDS.has('취소가맹점')).toBe(true);
  });

  it('HEADER_KEYWORDS contains 취소가맹점', () => {
    expect(HEADER_KEYWORDS).toContain('취소가맹점');
  });

  it('findColumn detects 취소가맹점 as merchant column', () => {
    const headers = ['이용일', '취소가맹점', '금액'];
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });
});

describe('Cycle 80: New AMOUNT_COLUMN_PATTERN terms (C80-02)', () => {
  it('AMOUNT_COLUMN_PATTERN matches 할인전금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('할인전금액')).toBe(true);
  });

  it('AMOUNT_COLUMN_PATTERN matches 할인후금액', () => {
    expect(AMOUNT_COLUMN_PATTERN.test('할인후금액')).toBe(true);
  });

  it('AMOUNT_KEYWORDS contains new terms', () => {
    expect(AMOUNT_KEYWORDS.has('할인전금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('할인후금액')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new amount terms', () => {
    expect(HEADER_KEYWORDS).toContain('할인전금액');
    expect(HEADER_KEYWORDS).toContain('할인후금액');
  });

  it('findColumn detects 할인전금액 as amount column', () => {
    const headers = ['이용일', '이용처', '할인전금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 할인후금액 as amount column', () => {
    const headers = ['이용일', '이용처', '할인후금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });
});

describe('Cycle 80: New SUMMARY_ROW_PATTERN terms (C80-03)', () => {
  it('SUMMARY_ROW_PATTERN matches 미결제잔액', () => {
    expect(SUMMARY_ROW_PATTERN.test('미결제잔액')).toBe(true);
  });

  it('SUMMARY_ROW_PATTERN matches 미결제 잔액 with space', () => {
    expect(SUMMARY_ROW_PATTERN.test('미결제 잔액')).toBe(true);
  });

  it('SUMMARY_ROW_PATTERN matches 카드이용합계', () => {
    expect(SUMMARY_ROW_PATTERN.test('카드이용합계')).toBe(true);
  });

  it('SUMMARY_ROW_PATTERN matches 카드 이용 합계 with spaces', () => {
    expect(SUMMARY_ROW_PATTERN.test('카드 이용 합계')).toBe(true);
  });

  it('SUMMARY_ROW_PATTERN matches 미결제잔액 in longer string', () => {
    expect(SUMMARY_ROW_PATTERN.test('미결제잔액 50,000')).toBe(true);
  });

  it('SUMMARY_ROW_PATTERN does not match merchant name containing 미결제', () => {
    expect(SUMMARY_ROW_PATTERN.test('미결제마트')).toBe(false);
  });

  it('SUMMARY_ROW_PATTERN does not match merchant name containing 카드이용', () => {
    expect(SUMMARY_ROW_PATTERN.test('카드이용마트')).toBe(false);
  });
});

describe('Cycle 80: Integration - fullwidth header CSV parsing', () => {
  it('findColumn handles fullwidth + Korean combined header', () => {
    const headers = ['Ｄａｔｅ/이용일', '가맹점명', 'Ａｍｏｕｎｔ'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('isValidHeaderRow accepts fullwidth + Korean mixed headers', () => {
    expect(isValidHeaderRow(['Ｄａｔｅ', '가맹점명', '이용금액'])).toBe(true);
  });
});
